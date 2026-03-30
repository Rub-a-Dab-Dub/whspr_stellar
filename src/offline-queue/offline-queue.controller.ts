import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OfflineQueueService } from './offline-queue.service';
import { QueueStatsDto, FlushResultDto } from './dto/offline-queue.dto';

@Controller()
export class OfflineQueueController {
  constructor(private readonly offlineQueueService: OfflineQueueService) {}

  /**
   * GET /admin/offline-queue/stats
   * Returns aggregate queue stats and any users over the alert threshold.
   */
  @Get('admin/offline-queue/stats')
  async getStats(): Promise<QueueStatsDto> {
    return this.offlineQueueService.getStats();
  }

  /**
   * POST /admin/offline-queue/flush/:userId
   * Force-flush a user's queue immediately (e.g. after support escalation).
   * Since we do not have access to the live socket here we only flush the
   * Postgres FAILED records back to QUEUED so the next reconnect picks them up.
   */
  @Post('admin/offline-queue/flush/:userId')
  @HttpCode(HttpStatus.OK)
  async forceFlush(@Param('userId') userId: string): Promise<FlushResultDto> {
    const retried = await this.offlineQueueService.retryFailed(userId);
    return { userId, flushed: 0, failed: retried };
  }
}
