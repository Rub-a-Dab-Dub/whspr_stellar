import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RoomPayment } from '../room/entities/room-payment.entity';
import { ChainController } from './chain.controller';
import { ChainService } from './chain.service';
import { ChainDetectionService } from './services/chain-detection.service';
import { ChainMonitoringService } from './services/chain-monitoring.service';
import { ChainAnalyticsService } from './services/chain-analytics.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoomPayment]), ScheduleModule.forRoot()],
  controllers: [ChainController],
  providers: [
    ChainService,
    ChainDetectionService,
    ChainMonitoringService,
    ChainAnalyticsService,
  ],
  exports: [ChainService, ChainDetectionService, ChainMonitoringService],
})
export class ChainModule {}
