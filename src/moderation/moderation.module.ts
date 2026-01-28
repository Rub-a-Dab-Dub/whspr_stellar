import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedUser } from './entities/blocked-user.entity';
import { Report } from './entities/report.entity';
import { ModerationService } from './services/moderation.service';
import {
  BlockingController,
  ReportController,
} from './controllers/moderation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BlockedUser, Report])],
  controllers: [BlockingController, ReportController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
