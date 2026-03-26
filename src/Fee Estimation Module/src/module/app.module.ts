import { Module } from '@nestjs/common';
import { FeeEstimationModule } from '../module/fee-estimation.module';

@Module({
  imports: [FeeEstimationModule]
})
export class AppModule {}
