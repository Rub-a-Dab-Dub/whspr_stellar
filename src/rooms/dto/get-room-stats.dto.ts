import { IsEnum, IsOptional } from 'class-validator';

export enum StatsPeriod {
  HOURS_24 = '24h',
  DAYS_7 = '7d',
  DAYS_30 = '30d',
}

export class GetRoomStatsDto {
  @IsOptional()
  @IsEnum(StatsPeriod)
  period?: StatsPeriod = StatsPeriod.HOURS_24;
}
