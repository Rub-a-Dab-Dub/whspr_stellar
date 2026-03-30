import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsProcessor } from './receipts.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'export-queue',
    }),
  ],
  controllers: [ReceiptsController],
  providers: [ReceiptsService, ReceiptsProcessor],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
