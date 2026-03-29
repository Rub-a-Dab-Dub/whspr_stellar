import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationDigestService } from './notification-digest.service';
import { SetQuietHoursDto } from './dto/set-quiet-hours.dto';
import {
  DigestSendResponseDto,
  QuietHoursConfigResponseDto,
} from './dto/notification-digest-response.dto';

@ApiTags('Notification Digest')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationDigestController {
  constructor(private readonly digestService: NotificationDigestService) {}

  // ─── GET /settings/quiet-hours ───────────────────────────────────────────────

  @Get('settings/quiet-hours')
  @ApiOperation({ summary: "Get the current user's quiet hours configuration" })
  @ApiResponse({ status: 200, type: QuietHoursConfigResponseDto })
  async getQuietHours(
    @Request() req: { user: { userId: string } },
  ): Promise<QuietHoursConfigResponseDto> {
    return this.digestService.getQuietHoursConfig(req.user.userId);
  }

  // ─── PUT /settings/quiet-hours ───────────────────────────────────────────────

  @Put('settings/quiet-hours')
  @ApiOperation({ summary: "Update the current user's quiet hours configuration" })
  @ApiResponse({ status: 200, type: QuietHoursConfigResponseDto })
  async setQuietHours(
    @Request() req: { user: { userId: string } },
    @Body() dto: SetQuietHoursDto,
  ): Promise<QuietHoursConfigResponseDto> {
    return this.digestService.setQuietHours(req.user.userId, dto);
  }

  // ─── POST /notifications/digest/send-now ────────────────────────────────────

  @Post('notifications/digest/send-now')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Immediately flush and send the pending notification digest',
  })
  @ApiResponse({ status: 200, type: DigestSendResponseDto })
  async sendNow(
    @Request() req: { user: { userId: string } },
  ): Promise<DigestSendResponseDto> {
    return this.digestService.sendDigest(req.user.userId);
  }
}
