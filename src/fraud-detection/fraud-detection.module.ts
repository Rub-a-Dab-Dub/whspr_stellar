import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { LoginAttempt } from './entities/login-attempt.entity';
import { GeoService } from './geo.service';
import { FraudDetectionService } from './fraud-detection.service';
import { FraudDetectionController } from './controllers/fraud-detection.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoginAttempt]),
    HttpModule,
  ],
  controllers: [FraudDetectionController],
  providers: [GeoService, FraudDetectionService],
  exports: [FraudDetectionService],
})
export class FraudDetectionModule {}
