import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rpc } from 'stellar-sdk';

@Injectable()
export class SorobanRpcService {
  private readonly logger = new Logger(SorobanRpcService.name);
  private readonly server: rpc.Server;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>(
      'SOROBAN_RPC_URL',
      'https://soroban-testnet.stellar.org:443',
    );
    this.server = new rpc.Server(rpcUrl);
  }

  async getEvents(
    startLedger: number,
    contractIds: string[],
    cursor?: string,
  ): Promise<rpc.Api.GetEventsResponse> {
    try {
      this.logger.debug(
        `Fetching Soroban events from ledger ${startLedger} for contracts: ${contractIds.join(', ')}`,
      );

      return await this.server.getEvents({
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds,
          },
        ],
        cursor,
        limit: 100,
      });
    } catch (error: any) {
      this.logger.error(`Failed to fetch Soroban events: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getLatestLedger(): Promise<number> {
    try {
      const networkInfo = await this.server.getLatestLedger();
      return networkInfo.sequence;
    } catch (error: any) {
      this.logger.error(`Failed to fetch latest ledger: ${error.message}`, error.stack);
      throw error;
    }
  }
}
