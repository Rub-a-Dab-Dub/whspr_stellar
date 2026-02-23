import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { StellarBlockchainEvent, StellarEventStatus } from './entities/stellar-event.entity';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Injectable()
export class StellarEventRecoveryService implements OnModuleInit {
    private readonly logger = new Logger(StellarEventRecoveryService.name);

    constructor(
        @InjectRepository(StellarBlockchainEvent)
        private eventRepo: Repository<StellarBlockchainEvent>,
        @InjectQueue(QUEUE_NAMES.STELLAR_EVENT_PROCESSING)
        private eventQueue: Queue,
    ) { }

    async onModuleInit() {
        this.logger.log('StellarEventRecoveryService initialized');
    }

    @Cron(CronExpression.EVERY_HOUR)
    async recoverFailedEvents() {
        this.logger.log('Running recovery for failed Stellar events...');

        const failedEvents = await this.eventRepo.find({
            where: {
                status: StellarEventStatus.FAILED,
                // Optional: Only retry if updated more than X minutes ago
                updatedAt: LessThan(new Date(Date.now() - 30 * 60 * 1000)), // 30 mins
            },
            take: 100,
        });

        if (failedEvents.length === 0) {
            this.logger.log('No failed events found for recovery');
            return;
        }

        this.logger.log(`Found ${failedEvents.length} failed events. Re-queueing...`);

        for (const event of failedEvents) {
            event.status = StellarEventStatus.PENDING;
            await this.eventRepo.save(event);

            await this.eventQueue.add('process-stellar-event', {
                id: event.id,
            });
        }

        this.logger.log(`Successfully re-queued ${failedEvents.length} events for processing`);
    }
}
