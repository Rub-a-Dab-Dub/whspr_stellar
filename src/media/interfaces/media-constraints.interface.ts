import { MediaType } from '../enums/media-type.enum';

export interface ResizeDimension {
  width: number;
  height: number;
  suffix: string;
}

export interface MediaConstraints {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  resizeDimensions?: ResizeDimension[];
  generateThumbnail: boolean;
}

export const MEDIA_CONSTRAINTS: Record<MediaType, MediaConstraints> = {
  [MediaType.AVATAR]: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    resizeDimensions: [
      { width: 256, height: 256, suffix: '256' },
      { width: 64, height: 64, suffix: '64' },
    ],
    generateThumbnail: true,
  },
  [MediaType.BANNER]: {
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    resizeDimensions: [{ width: 1500, height: 500, suffix: 'banner' }],
    generateThumbnail: false,
  },
  [MediaType.MESSAGE_ATTACHMENT]: {
    maxSizeBytes: 25 * 1024 * 1024, // 25 MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    generateThumbnail: false,
  },
  [MediaType.GROUP_AVATAR]: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    resizeDimensions: [
      { width: 256, height: 256, suffix: '256' },
      { width: 64, height: 64, suffix: '64' },
    ],
    generateThumbnail: true,
  },
};
