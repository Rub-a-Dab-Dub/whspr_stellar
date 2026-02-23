import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SorobanRpc, xdr, scValToNative } from '@stellar/stellar-sdk';
import { StellarBlockchainEvent, StellarSyncState, StellarEventStatus } from './entities/stellar-event.entity';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Injectable()
export class StellarEventListenerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(StellarEventListenerService.name);
    private server: SorobanRpc.Server;
    private pollInterval: NodeJS.Timeout;
    private isPolling = false;

    constructor(
        private configService: ConfigService,
        @InjectRepository(StellarBlockchainEvent)
        private eventRepo: Repository<StellarBlockchainEvent>,
        @InjectRepository(StellarSyncState)
        private syncStateRepo: Repository<StellarSyncState>,
        @InjectQueue(QUEUE_NAMES.STELLAR_EVENT_PROCESSING)
        private eventQueue: Queue,
    ) {
        const rpcUrl = this.configService.get<string>('stellar.rpcUrl');
        this.server = new SorobanRpc.Server(rpcUrl);
    }

    async onModuleInit() {
        this.startPolling();
    }

    onModuleDestroy() {
        this.stopPolling();
    }

    private startPolling() {
        const interval = this.configService.get<number>('stellar.pollIntervalMs', 5000);
        this.pollInterval = setInterval(() => this.pollEvents(), interval);
        this.logger.log(`Started polling Stellar events every ${interval}ms`);
    }

    private stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }

    private async pollEvents() {
        if (this.isPolling) return;
        this.isPolling = true;

        try {
            const contractId = this.configService.get<string>('stellar.contractId');
            if (!contractId) {
                this.logger.warn('WHSPR_CONTRACT_ID not configured, skipping poll');
                return;
            }

            let syncState = await this.syncStateRepo.findOne({ where: { contractId } });
            if (!syncState) {
                const startLedger = this.configService.get<number>('stellar.startLedger', 0);
                syncState = this.syncStateRepo.create({
                    contractId,
                    lastSyncedLedger: startLedger,
                    lastSyncedAt: new Date(),
                });
                await this.syncStateRepo.save(syncState);
            }

            const latestLedger = await this.server.getLatestLedger();
            const fromLedger = syncState.lastSyncedLedger + 1;
            const toLedger = latestLedger.sequence;

            if (fromLedger > toLedger) {
                return;
            }

            this.logger.debug(`Polling events from ledger ${fromLedger} to ${toLedger}`);

            let currentLedger = fromLedger;
            const limit = 100;

            while (currentLedger <= toLedger) {
                // Fetch in blocks to avoid huge responses if many blocks passed
                const endBlock = Math.min(currentLedger + 1000, toLedger);

                const response = await this.server.getEvents({
                    startLedger: currentLedger,
                    // Note: Soroban getEvents might not support endLedger in all versions, 
                    // but we can filter by ledger sequence in results if needed.
                    filters: [
                        {
                            type: 'contract',
                            contractIds: [contractId],
                        },
                    ],
                });

                if (response.events && response.events.length > 0) {
                    for (const event of response.events) {
                        // Ensure we don't process events past our target toLedger if SDK returns more
                        if (event.ledger > toLedger) break;
                        await this.handleRawEvent(event);
                    }
                }

                currentLedger = endBlock + 1;

                // Update sync state incrementally for safety
                syncState.lastSyncedLedger = Math.min(endBlock, toLedger);
                syncState.lastSyncedAt = new Date();
                await this.syncStateRepo.save(syncState);
            }

        } catch (error) {
            this.logger.error('Error polling Stellar events:', error.stack || error.message);
        } finally {
            this.isPolling = false;
        }
    }

    private async handleRawEvent(event: SorobanRpc.Api.GetEventResponse) {
        try {
            // Check if already processed
            const existing = await this.eventRepo.findOne({
                where: {
                    transactionHash: event.transactionHash,
                    eventIndex: event.id.split('-').pop() ? parseInt(event.id.split('-').pop()!) : 0,
                },
            });

            if (existing) return;

            const topics = event.topic.map((t) => scValToNative(xdr.ScVal.fromXDR(t, 'base64')));
            const eventName = topics[0] as string;
            const eventData = scValToNative(xdr.ScVal.fromXDR(event.value, 'base64'));

            const stellarEvent = this.eventRepo.create({
                transactionHash: event.transactionHash,
                eventIndex: event.id.split('-').pop() ? parseInt(event.id.split('-').pop()!) : 0,
                ledger: event.ledger,
                contractId: event.contractId,
                eventName,
                topics,
                eventData,
                rawEvent: event,
                status: StellarEventStatus.PENDING,
            });

            await this.eventRepo.save(stellarEvent);

            // Queue for processing
            await this.eventQueue.add('process-stellar-event', {
                id: stellarEvent.id,
            });

            this.logger.log(`Captured Stellar event: ${eventName} in tx ${event.transactionHash}`);
        } catch (error) {
            this.logger.error(`Error handling raw Stellar event ${event.id}:`, error.stack);
        }
    }
}
