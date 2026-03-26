import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Networks, SorobanRpc } from 'stellar-sdk';
import { TransactionStatus } from '../entities/transaction.entity';

export interface SorobanTransactionStatusResult {
  status: TransactionStatus;
  ledger?: string | null;
  failureReason?: string | null;
}

@Injectable()
export class SorobanTransactionsService {
  private readonly logger = new Logger(SorobanTransactionsService.name);
  private readonly server: SorobanRpc.Server;
  private readonly networkPassphrase: string;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>(
      'SOROBAN_RPC_URL',
      'http://localhost:8000/soroban/rpc',
    );

    this.server = new SorobanRpc.Server(rpcUrl, { allowHttp: true });
    this.networkPassphrase = this.configService.get<string>(
      'SOROBAN_NETWORK_PASSPHRASE',
      Networks.STANDALONE,
    );
  }

  async getTransactionStatus(txHash: string): Promise<SorobanTransactionStatusResult> {
    try {
      const response = await this.server.getTransaction(txHash);
      const ledger =
        response && 'latestLedger' in response && response.latestLedger
          ? String(response.latestLedger)
          : null;

      if (response.status === 'SUCCESS') {
        return {
          status: TransactionStatus.CONFIRMED,
          ledger,
        };
      }

      if (response.status === 'FAILED') {
        return {
          status: TransactionStatus.FAILED,
          ledger,
          failureReason:
            response && 'resultXdr' in response && response.resultXdr
              ? `Soroban execution failed (${response.resultXdr.slice(0, 120)})`
              : 'Soroban execution failed',
        };
      }

      return {
        status: TransactionStatus.PENDING,
        ledger,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch Soroban tx status for ${txHash} on ${this.networkPassphrase}: ${(error as Error).message}`,
      );

      return {
        status: TransactionStatus.PENDING,
      };
    }
  }
}
