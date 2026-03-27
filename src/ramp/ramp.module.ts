import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { RampTransaction } from './entities/ramp-transaction.entity';
import { RampService } from './ramp.service';
import { RampController } from './ramp.controller';
import { RampPollingService } from './ramp-polling.service';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RampTransaction]),
    HttpModule,
    ScheduleModule.forRoot(),
    WalletsModule,
  ],
  controllers: [RampController],
  providers: [RampService, RampPollingService],
  exports: [RampService],
})
export class RampModule {}
