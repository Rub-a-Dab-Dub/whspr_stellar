import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { SecurityAlert } from './entities/security-alert.entity';
import { SecurityAlertService } from './services/security-alert.service';
import { AnomalyDetectionService } from './services/anomaly-detection.service';
import { AnomalyCheckJobService } from './services/anomaly-check-job.service';
import { SecurityAlertsController } from './controllers/security-alerts.controller';
import { SecurityAlertsGateway } from './gateways/security-alerts.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityAlert]),
    BullModule.registerQueue({
      name: 'anomaly-detection',
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [SecurityAlertsController],
  providers: [
    SecurityAlertService,
    AnomalyDetectionService,
    AnomalyCheckJobService,
    SecurityAlertsGateway,
  ],
  exports: [
    SecurityAlertService,
    AnomalyDetectionService,
    SecurityAlertsGateway,
  ],
})
export class SecurityAlertsModule {}
