import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { create } from 'ipfs-http-client';
import * as crypto from 'crypto';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'] as const;
const ALLOWED_VIDEO_TYPES = ['video/mp4'] as const;
export const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES] as const;
export type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 20 * 1024 * 1024;

@Injectable()
export class IpfsService implements OnModuleInit {
  private readonly logger = new Logger(IpfsService.name);
  private client: Awaited<ReturnType<typeof create>> | null = null;
  private readonly gatewayUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.gatewayUrl =
      this.configService.get<string>('IPFS_GATEWAY_URL') ?? 'https://ipfs.io/ipfs';
  }

  onModuleInit() {
    const url = this.configService.get<string>('IPFS_HTTP_URL');
    if (!url) {
      this.logger.warn('IPFS_HTTP_URL not set; IPFS uploads will fail');
      return;
    }
    try {
      this.client = create(url);
      this.logger.log('IPFS client initialized');
    } catch (err) {
      this.logger.error('Failed to initialize IPFS client', err);
    }
  }

  static isAllowedMediaType(mime: string): mime is AllowedMediaType {
    return ALLOWED_MEDIA_TYPES.includes(mime as AllowedMediaType);
  }

  static getMaxBytesForMediaType(mime: string): number {
    if (ALLOWED_VIDEO_TYPES.includes(mime as (typeof ALLOWED_VIDEO_TYPES)[number])) {
      return VIDEO_MAX_BYTES;
    }
    return IMAGE_MAX_BYTES;
  }

  async add(buffer: Buffer): Promise<{ cid: { bytes: Uint8Array; toString: () => string }; path: string }> {
    if (!this.client) {
      throw new Error('IPFS client not initialized');
    }
    const result = this.client.add(buffer, { pin: true });
    let last: { cid: { bytes: Uint8Array; toString: () => string }; path: string } | null = null;
    for await (const entry of result) {
      last = { cid: entry.cid, path: entry.path };
    }
    if (!last) {
      throw new Error('IPFS add returned no result');
    }
    return last;
  }

  contentHashFromCid(cid: { bytes: Uint8Array }): string {
    const hash = crypto.createHash('sha256').update(Buffer.from(cid.bytes)).digest('hex');
    return hash;
  }

  gatewayUrlForCid(cid: { toString: () => string }): string {
    const path = cid.toString();
    const base = this.gatewayUrl.replace(/\/$/, '');
    return `${base}/${path}`;
  }
}
