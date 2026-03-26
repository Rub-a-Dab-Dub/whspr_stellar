import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SorobanRpc, xdr } from 'stellar-sdk';

export interface RawContractEvent {
  /** Soroban event id: "<ledger>-<txIndex>-<eventIndex>" — globally unique */
  eventId: string;
  contractId: string;
  ledgerSequence: number;
  eventIndex: number;
  /** base64-encoded XDR ScVal strings for each topic */
  topics: string[];
  /** base64-encoded XDR ScVal for the event value */
  valueXdr: string;
  pagingToken: string;
}

@Injectable()
export class SorobanRpcService implements OnModuleInit {
  private readonly logger = new Logger(SorobanRpcService.name);
  private server!: SorobanRpc.Server;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const rpcUrl = this.config.getOrThrow<string>('SOROBAN_RPC_URL');
    this.server = new SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
    this.logger.log(`Soroban RPC connected: ${rpcUrl}`);
  }

  async getLatestLedger(): Promise<number> {
    const info = await this.server.getLatestLedger();
    return info.sequence;
  }

  /**
   * Fetches raw contract events using _getEvents (returns base64 XDR strings).
   * Paginates via pagingToken cursor.
   */
  async getEvents(
    contractId: string,
    startLedger: number,
    topic0?: string,
    cursor?: string,
  ): Promise<{ events: RawContractEvent[]; nextCursor: string | null }> {
    const topicFilter = topic0 ? [[xdr.ScVal.scvSymbol(topic0).toXDR('base64')]] : undefined;

    const response = await this.server._getEvents({
      startLedger: cursor ? undefined : startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [contractId],
          ...(topicFilter ? { topics: topicFilter } : {}),
        },
      ],
      cursor,
      limit: 200,
    });

    const events: RawContractEvent[] = response.events.map((e) => {
      const parts = e.id.split('-');
      return {
        eventId: e.id,
        contractId: e.contractId,
        ledgerSequence: e.ledger,
        eventIndex: parseInt(parts[parts.length - 1] ?? '0', 10),
        topics: e.topic,
        valueXdr: e.value,
        pagingToken: e.pagingToken,
      };
    });

    const nextCursor = events.length === 200 ? events[events.length - 1]!.pagingToken : null;

    return { events, nextCursor };
  }
}
