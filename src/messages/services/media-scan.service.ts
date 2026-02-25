export interface MediaScanResult {
  safe: boolean;
  reason?: string;
}

export interface IMediaScanService {
  scan(buffer: Buffer, mediaType: string): Promise<MediaScanResult>;
}

export const MEDIA_SCAN_SERVICE = Symbol('IMediaScanService');
