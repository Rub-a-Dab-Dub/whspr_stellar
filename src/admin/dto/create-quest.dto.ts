import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsUUID,
  IsObject,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { QuestType, QuestStatus } from '../../quest/entities/quest.entity';
import { Type } from 'class-transformer';

export class CreateQuestDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(QuestType)
  type: QuestType;

  @IsNumber()
  @Min(0)
  @Max(10000)
  xpReward: number;

  @IsOptional()
  @IsUUID()
  badgeRewardId?: string;

  @IsOptional()
  @IsObject()
  condition?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @ValidateIf((obj) => {
    if (obj.endDate && obj.startDate) {
      return new Date(obj.endDate) <= new Date(obj.startDate);
    }
    return false;
  })
  endDate?: string;
}
