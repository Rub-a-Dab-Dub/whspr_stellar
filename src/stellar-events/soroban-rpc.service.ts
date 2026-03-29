import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rpc as SorobanRpc, xdr } from '@stellar/stellar-sdk';

/** Soroban RPC event shape varies by SDK minor; keep loose for mapping. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SorobanRawEvent = any;

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
  /** Typed Server in SDK 14+ is strict; _getEvents payload is still evolving. */
  private server!: InstanceType<typeof SorobanRpc.Server>;

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

    const request: Record<string, unknown> = {
      filters: [
        {
          type: 'contract',
          contractIds: [contractId],
          ...(topicFilter ? { topics: topicFilter } : {}),
        },
      ],
      limit: 200,
    };
    if (cursor) {
      request.cursor = cursor;
    } else {
      request.startLedger = startLedger;
    }

    const response = await (this.server as unknown as { _getEvents: (r: unknown) => Promise<{ events: SorobanRawEvent[] }> })._getEvents(request);

    const events: RawContractEvent[] = (response.events ?? []).map((e: SorobanRawEvent) => {
      const id = String(e.id);
      const parts = id.split('-');
      const contract = e.contractId;
      const contractStr = typeof contract === 'string' ? contract : String(contract ?? contractId);
      const value = e.value;
      const valueXdr = typeof value === 'string' ? value : value?.toXDR?.('base64') ?? '';
      const topicsRaw = e.topic ?? e.topics ?? [];
      const topics = (Array.isArray(topicsRaw) ? topicsRaw : []).map((t: unknown) =>
        typeof t === 'string' ? t : (t as { toXDR?: (f: string) => string })?.toXDR?.('base64') ?? '',
      );
      return {
        eventId: id,
        contractId: contractStr,
        ledgerSequence: Number(e.ledger),
        eventIndex: parseInt(parts[parts.length - 1] ?? '0', 10),
        topics,
        valueXdr,
        pagingToken: String(e.pagingToken ?? e.paging_token ?? id),
      };
    });

    const nextCursor = events.length === 200 ? events[events.length - 1]!.pagingToken : null;

    return { events, nextCursor };
  }
}
