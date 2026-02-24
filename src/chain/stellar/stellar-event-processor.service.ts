import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StellarBlockchainEvent, StellarEventStatus } from './entities/stellar-event.entity';
import { UserRegistrationHandler } from './handlers/user-registration.handler';
import { XPHandler } from './handlers/xp.handler';
import { TransferHandler } from './handlers/transfer.handler';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Processor(QUEUE_NAMES.STELLAR_EVENT_PROCESSING)
export class StellarEventProcessorService {
    private readonly logger = new Logger(StellarEventProcessorService.name);

    constructor(
        @InjectRepository(StellarBlockchainEvent)
        private eventRepo: Repository<StellarBlockchainEvent>,
        private registrationHandler: UserRegistrationHandler,
        private xpHandler: XPHandler,
        private transferHandler: TransferHandler,
    ) { }

    @Process('process-stellar-event')
    async handleEventProcessing(job: Job<{ id: string }>) {
        const { id } = job.data;
        const event = await this.eventRepo.findOne({ where: { id } });

        if (!event) {
            this.logger.error(`Event ${id} not found in database`);
            return;
        }

        if (event.status === StellarEventStatus.CONFIRMED) {
            return;
        }

        try {
            event.status = StellarEventStatus.PROCESSING;
            await this.eventRepo.save(event);

            this.logger.debug(`Processing event ${event.eventName} (${event.id})`);

            // Dispatch to specific handlers
            switch (event.eventName) {
                case 'user_registered':
                case 'username_updated':
                    await this.registrationHandler.handle(event);
                    break;
                case 'xp_changed':
                case 'level_up':
                    await this.xpHandler.handle(event);
                    break;
                case 'transfer':
                case 'tip':
                case 'claim_processed':
                    await this.transferHandler.handle(event);
                    break;
                default:
                    this.logger.warn(`No handler for event: ${event.eventName}`);
            }

            event.status = StellarEventStatus.CONFIRMED;
            event.synced = true;
            event.syncedAt = new Date();
            await this.eventRepo.save(event);

            this.logger.log(`Successfully processed event ${event.eventName} (${event.id})`);
        } catch (error) {
            this.logger.error(`Failed to process event ${id}:`, error.stack);
            event.status = StellarEventStatus.FAILED;
            event.errorMessage = error.message;
            await this.eventRepo.save(event);
            throw error;
        }
    }
}
