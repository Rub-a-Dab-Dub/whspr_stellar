import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class StickerWebpService {
  private readonly logger = new Logger(StickerWebpService.name);

  /**
   * Converts arbitrary raster input to WebP for smaller sticker payloads.
   */
  async toWebp(input: Buffer): Promise<Buffer> {
    try {
      return await sharp(input).webp({ quality: 86 }).toBuffer();
    } catch (e) {
      this.logger.warn(`sharp WebP conversion failed, returning original buffer: ${e}`);
      return input;
    }
  }
}
