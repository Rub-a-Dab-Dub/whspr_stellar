import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { AdminConfigService } from '../config/admin-config.service';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';
import { User } from '../user/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogArchive } from './entities/audit-log-archive.entity';
import { DataAccessLog } from './entities/data-access-log.entity';
import { AuditAlert } from './entities/audit-alert.entity';
import { AuditLogService } from './services/audit-log.service';
import { AuditLogRetentionJob } from './jobs/audit-log-retention.job';
import { Transfer } from '../transfer/entities/transfer.entity';
import { Session } from '../sessions/entities/session.entity';
import { Message } from '../message/entities/message.entity';
import { AdminEventStreamGateway } from './gateways/admin-event-stream.gateway';
import { Room } from '../room/entities/room.entity';
import { RoomMember } from '../room/entities/room-member.entity';
import { RoomPayment } from '../room/entities/room-payment.entity';
import { TransferModule } from '../transfer/transfer.module';
import { PlatformConfig } from './entities/platform-config.entity';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    JwtModule.register({}),
    forwardRef(() => TransferModule),
    LeaderboardModule,
    TypeOrmModule.forFeature([
      User,
      AuditLog,
      AuditLogArchive,
      DataAccessLog,
      AuditAlert,
      Transfer,
      Session,
      Message,
      Room,
      RoomMember,
      RoomPayment,
      PlatformConfig,
    ]),
  ],
  controllers: [AdminController],
  providers: [
    AdminConfigService,
    AdminService,
    AuditLogService,
    AuditLogRetentionJob,
    AdminEventStreamGateway,
  ],
  exports: [AdminConfigService, AdminService, AuditLogService],
})
export class AdminModule {}
