import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedUser } from './entities/blocked-user.entity';
import { Report } from './entities/report.entity';
import { ModerationService } from './services/moderation.service';
import {
  BlockingController,
  ReportController,
} from './controllers/moderation.controller';
import { ModerationAuditLog } from './moderation-audit-log.entity';
import { MessageModerationService } from './Services/message-moderation.service';
import { MessageModule } from '../message/message.module';
import { AdminModerationController } from './Controller/admin-moderation.controller';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlockedUser, Report, ModerationAuditLog]),
    MessageModule,
    RolesModule,
  ],
  controllers: [BlockingController, ReportController, AdminModerationController],
  providers: [ModerationService, MessageModerationService],
  exports: [ModerationService, MessageModerationService],
})
export class ModerationModule {}
