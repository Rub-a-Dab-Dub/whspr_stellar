import {
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  IsOptional,
  Min,
} from 'class-validator';
import { QuestType, RewardType } from '../entities/quest.entity';

export class CreateQuestDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  requirement: string;

  @IsNumber()
  @Min(1)
  requirementCount: number;

  @IsEnum(QuestType)
  type: QuestType;

  @IsEnum(RewardType)
  rewardType: RewardType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  xpReward?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  difficulty?: number;

  @IsNumber()
  @Min(0)
  rewardAmount: number;

  @IsDateString()
  activeUntil: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}
