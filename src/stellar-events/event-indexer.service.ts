import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { xdr, scValToNative } from 'stellar-sdk';
import { Interval } from '@nestjs/schedule';
import { ContractEvent } from './contract-event.entity';
import { IndexerCursor } from './indexer-cursor.entity';
import { SorobanRpcService, RawContractEvent } from './soroban-rpc.service';
import { ContractEventName, EventPayloads } from './event-schemas';

@Injectable()
export class EventIndexerService implements OnModuleInit {
  private readonly logger = new Logger(EventIndexerService.name);
  private contractIds: string[] = [];

  constructor(
    private readonly rpc: SorobanRpcService,
    private readonly config: ConfigService,
    @InjectRepository(ContractEvent)
    private readonly eventRepo: Repository<ContractEvent>,
    @InjectRepository(IndexerCursor)
    private readonly cursorRepo: Repository<IndexerCursor>,
  ) {}

  onModuleInit() {
    const ids = this.config.get<string>('SOROBAN_CONTRACT_IDS', '');
    this.contractIds = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!this.contractIds.length) {
      this.logger.warn('No SOROBAN_CONTRACT_IDS configured — event indexer idle');
    }
  }

  @Interval(6_000)
  async poll() {
    for (const contractId of this.contractIds) {
      await this.indexContract(contractId).catch((err: Error) =>
        this.logger.error(`Indexing failed for ${contractId}: ${err.message}`),
      );
    }
  }

  private async indexContract(contractId: string): Promise<void> {
    const cursor = await this.cursorRepo.findOne({ where: { contractId } });
    const startLedger = cursor ? cursor.lastLedger + 1 : 1;

    let nextCursor: string | null = null;
    let maxLedger = startLedger;

    do {
      const { events, nextCursor: nc } = await this.rpc.getEvents(
        contractId,
        startLedger,
        undefined,
        nextCursor ?? undefined,
      );

      if (events.length) {
        await this.persistEvents(events);
        maxLedger = Math.max(maxLedger, ...events.map((e) => e.ledgerSequence));
      }

      nextCursor = nc;
    } while (nextCursor);

    if (maxLedger > startLedger) {
      await this.cursorRepo.upsert({ contractId, lastLedger: maxLedger, updatedAt: new Date() }, [
        'contractId',
      ]);
    }
  }

  /**
   * INSERT ... ON CONFLICT DO NOTHING on eventId for idempotent deduplication.
   */
  private async persistEvents(raw: RawContractEvent[]): Promise<void> {
    const entities = raw.map((e) => this.mapToEntity(e));

    await this.eventRepo
      .createQueryBuilder()
      .insert()
      .into(ContractEvent)
      .values(entities)
      .orIgnore()
      .execute();
  }

  private mapToEntity(raw: RawContractEvent): Partial<ContractEvent> {
    const topics = raw.topics.map((t) => scValToNative(xdr.ScVal.fromXDR(t, 'base64')) as string);
    const payload = scValToNative(xdr.ScVal.fromXDR(raw.valueXdr, 'base64')) as object;

    return {
      eventId: raw.eventId,
      contractId: raw.contractId,
      ledgerSequence: raw.ledgerSequence,
      eventIndex: raw.eventIndex,
      topic0: topics[0] ?? '',
      topic1: topics[1] ?? null,
      topic2: topics[2] ?? null,
      payload,
      rawValueXdr: raw.valueXdr,
      processed: false,
    };
  }

  async findByContract(
    contractId: string,
    topic0?: ContractEventName,
    page = 1,
    limit = 50,
  ): Promise<[ContractEvent[], number]> {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .where('e.contractId = :contractId', { contractId })
      .orderBy('e.ledgerSequence', 'ASC')
      .addOrderBy('e.eventIndex', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (topic0) qb.andWhere('e.topic0 = :topic0', { topic0 });

    return qb.getManyAndCount();
  }

  async getTypedPayload<K extends ContractEventName>(
    event: ContractEvent,
  ): Promise<EventPayloads[K]> {
    return event.payload as EventPayloads[K];
  }
}
