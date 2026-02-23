import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { StellarBlockchainEvent, StellarSyncState } from './entities/stellar-event.entity';
import { StellarEventListenerService } from './stellar-event-listener.service';
import { StellarEventProcessorService } from './stellar-event-processor.service';
import { StellarEventRecoveryService } from './stellar-event-recovery.service';
import { StellarEventAnalyticsService } from './stellar-event-analytics.service';
import { UserRegistrationHandler } from './handlers/user-registration.handler';
import { XPHandler } from './handlers/xp.handler';
import { TransferHandler } from './handlers/transfer.handler';
import { User } from '../../user/entities/user.entity';
import { Transfer } from '../../transfer/entities/transfer.entity';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Module({
    imports: [
        TypeOrmModule.forFeature([StellarBlockchainEvent, StellarSyncState, User, Transfer]),
        BullModule.registerQueue({
            name: QUEUE_NAMES.STELLAR_EVENT_PROCESSING,
        }),
        ScheduleModule.forRoot(),
    ],
    providers: [
        StellarEventListenerService,
        StellarEventProcessorService,
        StellarEventRecoveryService,
        StellarEventAnalyticsService,
        UserRegistrationHandler,
        XPHandler,
        TransferHandler,
    ],
    exports: [StellarEventListenerService],
})
export class StellarModule { }
