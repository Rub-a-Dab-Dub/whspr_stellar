import { ApiProperty } from '@nestjs/swagger';
import { FeedbackType, FeedbackStatus, FeedbackPriority } from '../entities/feedback-report.entity';

export class FeedbackResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId?: string;

  @ApiProperty()
  type: FeedbackType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  screenshotUrl?: string;

  @ApiProperty()
  appVersion?: string;

  @ApiProperty()
  platform?: string;

  @ApiProperty()
  deviceInfo?: Record<string, any>;

  @ApiProperty()
  status: FeedbackStatus;

  @ApiProperty()
  priority: FeedbackPriority;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
