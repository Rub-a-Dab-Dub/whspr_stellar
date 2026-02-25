import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

export interface SendMessageResult {
  success: boolean;
  messageId?: bigint;
  transactionHash?: string;
  error?: string;
}

@Injectable()
export class ContractMessageService {
  private readonly logger = new Logger(ContractMessageService.name);
  private readonly server: StellarSdk.Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly sorobanRpcUrl: string;
  private readonly contractId: string | null;
  private readonly senderSecretKey: string | null;

  constructor(private readonly configService: ConfigService) {
    const horizonUrl =
      this.configService.get('STELLAR_HORIZON_URL') ?? 'https://horizon-testnet.stellar.org';
    this.server = new StellarSdk.Horizon.Server(horizonUrl);
    this.networkPassphrase =
      this.configService.get('STELLAR_NETWORK_PASSPHRASE') ?? StellarSdk.Networks.TESTNET;
    this.sorobanRpcUrl =
      this.configService.get('SOROBAN_RPC_URL') ?? 'https://soroban-testnet.stellar.org';
    this.contractId = this.configService.get('SOROBAN_CONTRACT_ID') ?? null;
    this.senderSecretKey = this.configService.get('STELLAR_SENDER_SECRET_KEY') ?? null;
  }

  async sendMessage(
    senderWalletAddress: string,
    roomId: bigint,
    contentHashHex: string,
    tipAmount: bigint = 0n,
  ): Promise<SendMessageResult> {
    if (!this.contractId || !this.senderSecretKey) {
      this.logger.warn(
        'send_message skipped: missing SOROBAN_CONTRACT_ID or STELLAR_SENDER_SECRET_KEY',
      );
      return {
        success: false,
        error:
          'Contract not configured. Set SOROBAN_CONTRACT_ID and STELLAR_SENDER_SECRET_KEY.',
      };
    }

    const keypair = StellarSdk.Keypair.fromSecret(this.senderSecretKey);
    if (keypair.publicKey() !== senderWalletAddress) {
      return {
        success: false,
        error: 'Backend signer does not match sender address',
      };
    }

    const contentHashBytes = Buffer.from(contentHashHex, 'hex');
    if (contentHashBytes.length !== 32) {
      return {
        success: false,
        error: 'Content hash must be 32 bytes (64 hex chars)',
      };
    }

    try {
      const rpc = new StellarSdk.SorobanRpc.Server(this.sorobanRpcUrl);
      const contract = new StellarSdk.Contract(this.contractId);

      const contentHashScVal = StellarSdk.xdr.ScVal.scvBytes(
        new Uint8Array(contentHashBytes),
      );

      const sourceAccount = await this.server.loadAccount(senderWalletAddress);

      const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'send_message',
            StellarSdk.Address.fromString(senderWalletAddress),
            BigInt(roomId),
            contentHashScVal,
            tipAmount,
          ),
        )
        .setTimeout(180);

      const builtTx = txBuilder.build();

      const simResponse = await rpc.simulateTransaction(builtTx);
      if (StellarSdk.SorobanRpc.Api.isSimulationError(simResponse)) {
        return {
          success: false,
          error: simResponse.error ?? 'Simulation failed',
        };
      }

      const assembledTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
        keypair,
        StellarSdk.BASE_FEE,
        builtTx,
        this.networkPassphrase,
      );
      assembledTx.sign(keypair);

      const sendResponse = await rpc.sendTransaction(assembledTx);
      if (sendResponse.status === 'ERROR') {
        return {
          success: false,
          error: sendResponse.errorResultXdr?.toString() ?? sendResponse.status,
        };
      }

      const result = simResponse.result?.retval
        ? StellarSdk.scValToNative(simResponse.result.retval)
        : undefined;
      const messageId = typeof result === 'bigint' ? result : undefined;

      return {
        success: true,
        messageId,
        transactionHash: sendResponse.hash,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`send_message failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }
}
