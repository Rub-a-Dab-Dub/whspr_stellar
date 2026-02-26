import { Injectable } from '@nestjs/common';
import { IMediaScanService, MediaScanResult } from './media-scan.service';

@Injectable()
export class NoOpMediaScanService implements IMediaScanService {
  async scan(_buffer: Buffer, _mediaType: string): Promise<MediaScanResult> {
    return { safe: true };
  }
}
