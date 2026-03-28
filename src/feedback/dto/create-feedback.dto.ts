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

  @ApiProperty({ example: 'https://s3.../screenshot.png', required: false })
  @IsOptional()
  @IsString()
  screenshotUrl?: string;

  @ApiProperty({ example: '2.3.1', required: false })
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiProperty({ example: 'ios', required: false })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiProperty({ example: { os: 'iOS 17', model: 'iPhone 14' }, required: false })
  @IsOptional()
  @IsString()
  deviceInfo?: string; // JSON string
}
