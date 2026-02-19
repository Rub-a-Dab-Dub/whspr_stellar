import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
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

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      User,
      AuditLog,
      AuditLogArchive,
      DataAccessLog,
      AuditAlert,
      Transfer,
      Session,
      Message,
    ]),
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    AuditLogService,
    AuditLogRetentionJob,
    AdminEventStreamGateway,
  ],
  exports: [AdminService, AuditLogService],
})
export class AdminModule {}
