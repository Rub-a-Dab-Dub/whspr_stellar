import {
  Module,
  forwardRef,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { AdminConfigService } from '../config/admin-config.service';
import { AdminController } from './controllers/admin.controller';
import { IpWhitelistController } from './controllers/ip-whitelist.controller';
import { AdminService } from './services/admin.service';
import { IpWhitelistService } from './services/ip-whitelist.service';
import { User } from '../user/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogArchive } from './entities/audit-log-archive.entity';
import { DataAccessLog } from './entities/data-access-log.entity';
import { AuditAlert } from './entities/audit-alert.entity';
import { IpWhitelist } from './entities/ip-whitelist.entity';
import { AuditLogService } from './services/audit-log.service';
import { AuditLogRetentionJob } from './jobs/audit-log-retention.job';
import { TemporaryBanCleanupJob } from './jobs/temporary-ban-cleanup.job';
import { AutoUnbanProcessor } from './jobs/auto-unban.processor';
import { Transfer } from '../transfer/entities/transfer.entity';
import { Session } from '../sessions/entities/session.entity';
import { Message } from '../message/entities/message.entity';
import { AdminEventStreamGateway } from './gateways/admin-event-stream.gateway';
import { Room } from '../room/entities/room.entity';
import { RoomMember } from '../room/entities/room-member.entity';
import { RoomPayment } from '../room/entities/room-payment.entity';
import { TransferModule } from '../transfer/transfer.module';
import { PlatformConfig } from './entities/platform-config.entity';
import { PlatformWalletWithdrawal } from './entities/platform-wallet-withdrawal.entity';
import { WithdrawalWhitelist } from './entities/withdrawal-whitelist.entity';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { IpWhitelistMiddleware } from './middleware/ip-whitelist.middleware';
import { SessionModule } from '../sessions/sessions.module';
import { MessageModule } from '../message/message.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';
import { AdminAuthModule } from './auth/admin-auth.module';
import { ModerationQueue } from '../moderation/moderation-queue.entity';
import { FlaggedMessage } from '../moderation/flagged-message.entity';
import { NotificationService } from '../notifications/services/notification.service';
import { QueueService } from '../queue/queue.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    JwtModule.register({}),
    forwardRef(() => TransferModule),
    forwardRef(() => AdminAuthModule),
    LeaderboardModule,
    SessionModule,
    MessageModule,
    UsersModule,
    NotificationsModule,
    QueueModule,
    TypeOrmModule.forFeature([
      User,
      AuditLog,
      AuditLogArchive,
      DataAccessLog,
      AuditAlert,
      IpWhitelist,
      Transfer,
      Session,
      Message,
      Room,
      RoomMember,
      RoomPayment,
      PlatformConfig,
      ModerationQueue,
      FlaggedMessage,
      PlatformWalletWithdrawal,
      WithdrawalWhitelist,
    ]),
    NotificationsModule,
    QueueModule,
  ],
  controllers: [AdminController, IpWhitelistController],
  providers: [
    AdminConfigService,
    AdminService,
    IpWhitelistService,
    AuditLogService,
    AuditLogRetentionJob,
    TemporaryBanCleanupJob,
    AutoUnbanProcessor,
    AdminEventStreamGateway,
    NotificationService,
    QueueService,
  ],
  exports: [AdminConfigService, AdminService, AuditLogService],
})
export class AdminModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(IpWhitelistMiddleware)
      .forRoutes({ path: 'admin/*', method: RequestMethod.ALL });
  }
}
