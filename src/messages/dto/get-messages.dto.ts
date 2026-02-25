import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum PaginationDirection {
  BEFORE = 'before',
  AFTER = 'after',
}

export class GetMessagesDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsEnum(PaginationDirection)
  direction?: PaginationDirection = PaginationDirection.BEFORE;
}
