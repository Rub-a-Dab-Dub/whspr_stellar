import { IsOptional, IsString, IsEnum, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { QuestType, QuestStatus } from '../../quest/entities/quest.entity';

export class GetQuestsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(QuestStatus)
  status?: QuestStatus;

  @IsOptional()
  @IsEnum(QuestType)
  type?: QuestType;

  @IsOptional()
  @IsDateString()
  startDateAfter?: string;

  @IsOptional()
  @IsDateString()
  endDateBefore?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
