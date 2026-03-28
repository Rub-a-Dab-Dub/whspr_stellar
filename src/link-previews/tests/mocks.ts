import { LinkPreview } from '../link-preview.entity';

export const mockPreview: LinkPreview = {
  id: 'preview-id',
  url: 'https://example.com',
  title: 'Example',
  description: 'Desc',
  imageUrl: 'https://ex.com/img.jpg',
  favicon: '/favicon.ico',
  siteName: 'Example',
  fetchedAt: new Date(),
  isFailed: false,
};

export const getPreviewDtoMock = () => ({ url: 'https://example.com' });

export const queuePreviewsDtoMock = () => ({
  messageId: 'msg-1',
  urls: ['https://ex.com'],
});
