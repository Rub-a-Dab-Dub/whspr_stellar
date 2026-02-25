import { IsEnum, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { EventType } from '../entities/analytics-event.entity';

export class QueryEventsDto {
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
