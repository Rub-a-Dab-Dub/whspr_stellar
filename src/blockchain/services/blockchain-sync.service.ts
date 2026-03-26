import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { scValToNative } from 'stellar-sdk';
import { BlockchainEvent } from '../entities/blockchain-event.entity';
import { BlockchainCursor } from '../entities/blockchain-cursor.entity';
import { SorobanRpcService } from './soroban-rpc.service';

@Injectable()
export class BlockchainSyncService {
  private readonly logger = new Logger(BlockchainSyncService.name);
  private readonly contractIds: string[];

  constructor(
    @InjectRepository(BlockchainEvent)
    private readonly eventRepository: Repository<BlockchainEvent>,
    @InjectRepository(BlockchainCursor)
    private readonly cursorRepository: Repository<BlockchainCursor>,
    private readonly sorobanRpc: SorobanRpcService,
    private readonly configService: ConfigService,
  ) {
    const idsStr = this.configService.get<string>('SOROBAN_CONTRACT_IDS', '');
    this.contractIds = idsStr.split(',').map((id) => id.trim()).filter(Boolean);
  }

  async syncEvents(): Promise<number> {
    if (this.contractIds.length === 0) {
      this.logger.warn('No Soroban contract IDs configured for syncing.');
      return 0;
    }

    const cursorId = 'soroban-events';
    let cursor = await this.cursorRepository.findOne({ where: { id: cursorId } });

    if (!cursor) {
      const latestLedger = await this.sorobanRpc.getLatestLedger();
      cursor = this.cursorRepository.create({
        id: cursorId,
        lastLedger: latestLedger - 10, // Start from 10 ledgers ago if new
      });
      await this.cursorRepository.save(cursor);
    }

    const response = await this.sorobanRpc.getEvents(
      Number(cursor.lastLedger),
      this.contractIds,
      cursor.lastCursor,
    );

    if (!response.events || response.events.length === 0) {
      return 0;
    }

    const newEvents = response.events.map((event) => {
      return this.eventRepository.create({
        contractId: event.contractId,
        ledger: event.ledger,
        ledgerClosedAt: new Date(event.ledgerClosedAt),
        transactionHash: event.txHash,
        topic: event.topic.join(','),
        value: scValToNative(event.value),
      });
    });

    await this.eventRepository.save(newEvents);

    // Update cursor with the latest ledger from the events or the response
    const latestEventLedger = Math.max(...newEvents.map((e) => Number(e.ledger)));
    cursor.lastLedger = latestEventLedger;
    cursor.lastCursor = response.latestLedger; // Or use the last event's paging token if available

    await this.cursorRepository.save(cursor);

    this.logger.log(`Synced ${newEvents.length} new Soroban events.`);
    return newEvents.length;
  }
}
