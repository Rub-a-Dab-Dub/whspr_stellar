// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

const NATIVE_TOKEN = 'native';

export interface TransferResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

@Injectable()
export class PaymentBlockchainService {
  private readonly logger = new Logger(PaymentBlockchainService.name);
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

  async executeTransfer(
    senderWalletAddress: string,
    recipientWalletAddress: string,
    amount: string,
    tokenAddress: string | null,
  ): Promise<TransferResult> {
    const isSoroban = tokenAddress && tokenAddress !== NATIVE_TOKEN && this.contractId;

    if (isSoroban) {
      return this.executeSorobanTransfer(
        senderWalletAddress,
        recipientWalletAddress,
        amount,
        tokenAddress,
      );
    }

    return this.executeClassicStellarTransfer(
      senderWalletAddress,
      recipientWalletAddress,
      amount,
    );
  }

  private async executeClassicStellarTransfer(
    senderPublicKey: string,
    recipientPublicKey: string,
    amount: string,
  ): Promise<TransferResult> {
    try {
      const senderAccount = await this.server.loadAccount(senderPublicKey);
      const keypair = this.senderSecretKey
        ? StellarSdk.Keypair.fromSecret(this.senderSecretKey)
        : null;

      const txBuilder = new StellarSdk.TransactionBuilder(senderAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: recipientPublicKey,
            asset: StellarSdk.Asset.native(),
            amount,
          }),
        )
        .setTimeout(180);

      const transaction = txBuilder.build();

      if (keypair && keypair.publicKey() === senderPublicKey) {
        transaction.sign(keypair);
        const result = await this.server.submitTransaction(transaction);
        return {
          success: result.successful,
          transactionHash: result.hash,
        };
      }

      return {
        success: true,
        transactionHash: transaction.hash().toString('hex'),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Classic Stellar transfer failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }

  private async executeSorobanTransfer(
    senderAddress: string,
    recipientAddress: string,
    amount: string,
    tokenAddress: string,
  ): Promise<TransferResult> {
    if (!this.contractId || !this.senderSecretKey) {
      this.logger.warn('Soroban transfer skipped: missing SOROBAN_CONTRACT_ID or STELLAR_SENDER_SECRET_KEY');
      return {
        success: false,
        error: 'Soroban transfer not configured. Set SOROBAN_CONTRACT_ID and STELLAR_SENDER_SECRET_KEY.',
      };
    }

    try {
      const rpc = new StellarSdk.SorobanRpc.Server(this.sorobanRpcUrl);
      const keypair = StellarSdk.Keypair.fromSecret(this.senderSecretKey);

      if (keypair.publicKey() !== senderAddress) {
        return {
          success: false,
          error: 'Backend signer does not match sender address',
        };
      }

      const contract = new StellarSdk.Contract(this.contractId);
      const amountI128 = this.toStroops(amount);
      const amountScVal = (StellarSdk as { nativeToScVal?: (v: bigint, opts?: { type: string }) => unknown })
        .nativeToScVal?.(amountI128, { type: 'i128' }) ?? { type: 'i128', hi: 0, lo: Number(amountI128) };

      const sourceAccount = await this.server.loadAccount(senderAddress);

      const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'transfer_tokens',
            StellarSdk.Address.fromString(senderAddress),
            StellarSdk.Address.fromString(recipientAddress),
            StellarSdk.Address.fromString(tokenAddress),
            amountScVal as never,
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

      return {
        success: true,
        transactionHash: sendResponse.hash,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Soroban transfer failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }

  private toStroops(amount: string): bigint {
    const [whole, frac = ''] = amount.split('.');
    const padded = frac.padEnd(7, '0').slice(0, 7);
    return BigInt(whole + padded);
  }
}
