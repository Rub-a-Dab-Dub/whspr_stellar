import { Test, TestingModule } from '@nestjs/testing';
import { StickerWebpService } from './sticker-webp.service';

/** Minimal valid 1×1 PNG for sharp. */
const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('StickerWebpService', () => {
  let service: StickerWebpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StickerWebpService],
    }).compile();
    service = module.get(StickerWebpService);
  });

  it('converts PNG to WebP bytes', async () => {
    const out = await service.toWebp(ONE_PX_PNG);
    expect(out.length).toBeGreaterThan(0);
    expect(out.subarray(0, 4).toString('ascii')).toBe('RIFF');
  });

  it('returns original buffer when input is not a valid image', async () => {
    const garbage = Buffer.from('not-an-image');
    const out = await service.toWebp(garbage);
    expect(out.equals(garbage)).toBe(true);
  });
});
