import { Injectable, Logger } from '@nestjs/common';
import { SorobanClientService } from '../soroban-client/soroban-client.service';
import { Networks, TransactionBuilder, xdr, nativeToScVal } from '@stellar/stellar-sdk';

@Injectable()
export class UserRegistryContractService {
  private readonly logger = new Logger(UserRegistryContractService.name);
  private readonly contractId: string;

  constructor(private readonly sorobanClient: SorobanClientService) {
    this.contractId = process.env.USER_REGISTRY_CONTRACT_ID ?? '';
  }

  async registerUser(userId: string, publicKey: string): Promise<string> {
    this.logger.log(`Registering user: ${userId}`);

    const account = await this.sorobanClient
      .getServer()
      .getAccount(this.sorobanClient.getKeypair().publicKey());

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        new (await import('@stellar/stellar-sdk')).Contract(
          this.contractId,
        ).call(
          'register_user',
          nativeToScVal(userId, { type: 'string' }),
          nativeToScVal(publicKey, { type: 'string' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }

  async getUser(userId: string): Promise<any> {
    this.logger.log(`Fetching user: ${userId}`);
    return this.sorobanClient.callView(
      this.contractId,
      'get_user',
      [nativeToScVal(userId, { type: 'string' })],
    );
  }

  async isUserRegistered(userId: string): Promise<boolean> {
    return this.sorobanClient.callView(
      this.contractId,
      'is_registered',
      [nativeToScVal(userId, { type: 'string' })],
    );
  }
}