import { Injectable, Logger } from '@nestjs/common';

export interface WaveformJob {
  voiceMessageId: string;
  fileKey: string;
}

/**
 * Async background queue for waveform generation.
 *
 * Uses a simple setTimeout-based in-process queue that mirrors the
 * VirusScanQueueService pattern already in the codebase.
 * Swap for BullMQ when a Redis-backed queue is required.
 *
 * The actual ffprobe call is stubbed — replace processJob() with a
 * real ffprobe/fluent-ffmpeg invocation in production.
 */
@Injectable()
export class WaveformQueueService {
  private readonly logger = new Logger(WaveformQueueService.name);

  async enqueue(job: WaveformJob): Promise<void> {
    setTimeout(() => {
      this.processJob(job);
    }, 0);
  }

  private processJob(job: WaveformJob): void {
    // TODO: run ffprobe against the stored file, extract amplitude samples,
    // then update VoiceMessage.waveformData via VoiceMessageRepository.
    this.logger.log(
      `Waveform generation queued for voiceMessageId=${job.voiceMessageId} fileKey=${job.fileKey}`,
    );
  }
}
