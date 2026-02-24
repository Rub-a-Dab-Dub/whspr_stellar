import { IsEnum, IsString } from 'class-validator';
import { QuestStatus } from '../../quest/entities/quest.entity';

export class UpdateQuestStatusDto {
  @IsEnum(QuestStatus)
  status: QuestStatus;

  @IsString()
  reason: string;
}
