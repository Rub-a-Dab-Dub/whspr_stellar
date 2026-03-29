import { ApiProperty } from '@nestjs/swagger';
import { FeedbackResponseDto } from './feedback-response.dto';
import { FeedbackType, FeedbackStatus, FeedbackPriority } from '../entities/feedback-report.entity';

export class ScreenshotPresign {
  @ApiProperty()
  uploadUrl!: string;

  @ApiProperty()
  fileKey!: string;

  @ApiProperty()
  fileUrl!: string;

  @ApiProperty()
  expiresIn!: number;
}

export class CreateFeedbackResponseDto extends FeedbackResponseDto {
  @ApiProperty({ type: ScreenshotPresign, required: false })
  screenshotPresign?: ScreenshotPresign;
}

