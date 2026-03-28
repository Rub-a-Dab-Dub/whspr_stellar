import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ModerationAction,
  ModerationReviewStatus,
  ModerationTargetType,
} from '../entities/moderation-result.entity';

export class ModerationResultsQueryDto {
  @ApiPropertyOptional({ enum: ModerationTargetType })
  @IsOptional()
  @IsEnum(ModerationTargetType)
  targetType?: ModerationTargetType;

  @ApiPropertyOptional({ enum: ModerationAction })
  @IsOptional()
  @IsEnum(ModerationAction)
  action?: ModerationAction;

  @ApiPropertyOptional({ enum: ModerationReviewStatus })
  @IsOptional()
  @IsEnum(ModerationReviewStatus)
  reviewStatus?: ModerationReviewStatus;

  @ApiPropertyOptional({ description: 'true or false' })
  @IsOptional()
  @IsBooleanString()
  flagged?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetId?: string;
}
