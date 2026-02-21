import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { QuestService } from './quest.service';
import { QuestController } from './quest.controller';
import { Quest } from './entities/quest.entity';
import { UserQuestProgress } from './entities/user-quest-progress.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quest, UserQuestProgress]),
    ScheduleModule.forRoot(), // Enable cron jobs
  ],
  controllers: [QuestController],
  providers: [QuestService],
  exports: [QuestService], // Export for use in other modules
})
export class QuestModule {}
