import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  SorobanRpc,
  Networks,
  Contract,
  nativeToScVal,
} from 'stellar-sdk';
import { EncryptionKey } from './entities/encryption-key.entity';

const CONFIRMATION_POLL_MS = 1_000;
const CONFIRMATION_TIMEOUT_MS = 10_000;

@Injectable()
export class SorobanKeyRegistryService {
  private readonly logger = new Logger(SorobanKeyRegistryService.name);
  private readonly server: SorobanRpc.Server;
  private readonly networkPassphrase: string;
  private readonly contractId: string;
  private readonly adminKeypair: Keypair;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = config.get<string>('SOROBAN_RPC_URL', 'http://localhost:8000/soroban/rpc');
    this.networkPassphrase = config.get<string>(
      'SOROBAN_NETWORK_PASSPHRASE',
      Networks.STANDALONE,
    );
    this.contractId = config.get<string>('SOROBAN_KEY_REGISTRY_CONTRACT_ID', '');
    const adminSecret = config.get<string>('SOROBAN_ADMIN_SECRET_KEY', '');

    this.server = new SorobanRpc.Server(rpcUrl, { allowHttp: true });
    this.adminKeypair = adminSecret ? Keypair.fromSecret(adminSecret) : Keypair.random();
  }

  async registerKey(key: EncryptionKey): Promise<boolean> {
    if (!this.contractId) {
      this.logger.warn('SOROBAN_KEY_REGISTRY_CONTRACT_ID not set — skipping on-chain key registration');
      return false;
    }

    try {
      const adminAccount = await this.server.getAccount(this.adminKeypair.publicKey());
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(adminAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'register_key',
            nativeToScVal(key.userId, { type: 'string' }),
            nativeToScVal(key.publicKey, { type: 'string' }),
            nativeToScVal(key.keyType, { type: 'string' }),
            nativeToScVal(key.version, { type: 'u32' }),
          ),
        )
        .setTimeout(30)
        .build();

      const preparedTx = await this.server.prepareTransaction(tx);
      preparedTx.sign(this.adminKeypair);

      const result = await this.server.sendTransaction(preparedTx);

      if (result.status === 'ERROR') {
        this.logger.error(`Key registration failed on chain: ${JSON.stringify(result.errorResult)}`);
        return false;
      }

      return await this.waitForConfirmation(result.hash);
    } catch (error) {
      this.logger.error(`Soroban registerKey error: ${(error as Error).message}`);
      return false;
    }
  }

  async revokeKey(userId: string, publicKey: string): Promise<boolean> {
    if (!this.contractId) {
      this.logger.warn('SOROBAN_KEY_REGISTRY_CONTRACT_ID not set — skipping on-chain key revocation');
      return false;
    }

    try {
      const adminAccount = await this.server.getAccount(this.adminKeypair.publicKey());
      const contract = new Contract(this.contractId);

      const tx = new TransactionBuilder(adminAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'revoke_key',
            nativeToScVal(userId, { type: 'string' }),
            nativeToScVal(publicKey, { type: 'string' }),
          ),
        )
        .setTimeout(30)
        .build();

      const preparedTx = await this.server.prepareTransaction(tx);
      preparedTx.sign(this.adminKeypair);

      const result = await this.server.sendTransaction(preparedTx);

      if (result.status === 'ERROR') {
        this.logger.error(`Key revocation failed on chain: ${JSON.stringify(result.errorResult)}`);
        return false;
      }

      return await this.waitForConfirmation(result.hash);
    } catch (error) {
      this.logger.error(`Soroban revokeKey error: ${(error as Error).message}`);
      return false;
    }
  }

  private async waitForConfirmation(hash: string): Promise<boolean> {
    const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const response = await this.server.getTransaction(hash);

      if (response.status === 'SUCCESS') {
        this.logger.log(`Transaction ${hash} confirmed on chain`);
        return true;
      }

      if (response.status === 'FAILED') {
        this.logger.error(`Transaction ${hash} failed on chain`);
        return false;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, CONFIRMATION_POLL_MS));
    }

    this.logger.warn(`Transaction ${hash} confirmation timed out after ${CONFIRMATION_TIMEOUT_MS}ms`);
    return false;
  }
}
