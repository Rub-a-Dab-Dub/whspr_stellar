import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FeedbackType } from '../entities/feedback-report.entity';

export class CreateFeedbackDto {
  @ApiProperty({ enum: FeedbackType, example: FeedbackType.BUG })
  @IsEnum(FeedbackType)
  type: FeedbackType;

  @ApiProperty({ example: 'App crashes on login' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Steps to reproduce...' })
  @IsString()
  @MinLength(10)
  description: string;

@ApiProperty({ description: 'Request screenshot presign URL (generates pre-signed S3 upload)', required: false })
  @IsOptional()
  @IsBoolean()
  screenshot?: boolean;
}
