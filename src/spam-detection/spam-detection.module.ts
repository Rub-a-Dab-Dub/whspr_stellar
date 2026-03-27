import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { SpamDetectionService } from './spam-detection.service';
import { SpamDetectionController } from './spam-detection.controller';
import { SpamDetectionProcessor } from './queues/spam-detection.processor';
import { SpamScoresRepository } from './spam-scores.repository';
import { SpamScore } from './entities/spam-score.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SpamScore]),
    BullModule.registerQueue({
      name: 'spam-detection',
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // keep for 1 hour for analysis
        },
      },
    }),
    UsersModule,
  ],
  providers: [SpamDetectionService, SpamDetectionProcessor, SpamScoresRepository],
  controllers: [SpamDetectionController],
  exports: [SpamDetectionService],
})
export class SpamDetectionModule {}
