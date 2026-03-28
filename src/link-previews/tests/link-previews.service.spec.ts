import { Test } from '@nestjs/testing';
import { LinkPreviewsService } from '../link-previews.service';
import { LinkPreviewsRepository } from '../link-previews.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LinkPreview } from '../link-preview.entity';
import { mockPreview } from './mocks';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { HttpService } from '@nestjs/axios';
import * as cheerio from 'cheerio';

describe('LinkPreviewsService', () => {
  let service: LinkPreviewsService;
  let repoMock: jest.Mocked<LinkPreviewsRepository>;
  let redisMock: jest.Mocked<Redis>;
  let queueMock: jest.Mocked<Queue>;
  let httpMock: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LinkPreviewsService,
        {
          provide: getRepositoryToken(LinkPreview),
          useValue: {},
        },
        {
          provide: LinkPreviewsRepository,
          useValue: { savePreview: jest.fn(), findByUrl: jest.fn(), updateByUrl: jest.fn(), findByUrlOrFail: jest.fn() },
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: Queue,
          useValue: { add: jest.fn() },
        },
        {
          provide: HttpService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<LinkPreviewsService>(LinkPreviewsService);
    repoMock = module.get(LinkPreviewsRepository) as any;
    redisMock = module.get('REDIS_CLIENT') as any;
    queueMock = module.get(Queue) as any;
    httpMock = module.get(HttpService) as any;
  });

  it('should extract urls', () => {
    const urls = service['extractUrlsFromMessage']('Check https://ex.com');
    expect(urls).toEqual(['https://ex.com']);
  });

  it('should queue previews', async () => {
    queueMock.add.mockResolvedValue({} as any);
    const result = await service.queuePreviewUrls('msg1', ['https://ex.com']);
    expect(queueMock.add).toHaveBeenCalled();
    expect(result).toEqual(expect.arrayContaining([expect.any(Object)]));
  });

  it('should get cached preview', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify(mockPreview));
    const result = await service.getPreview('https://ex.com');
    expect(result).toEqual(mockPreview);
    expect(repoMock.findByUrl).not.toHaveBeenCalled();
  });

  it('should get db preview', async () => {
    redisMock.get.mockResolvedValue(null);
    repoMock.findByUrl.mockResolvedValue(mockPreview);
    const result = await service.getPreview('https://ex.com');
    expect(result).toEqual(mockPreview);
    expect(redisMock.set).toHaveBeenCalled();
  });

  it('should fetch preview', async () => {
    const mockRes = {
      data: `<html><head><meta property="og:title" content="Test"/></head></html>`,
    };
    httpMock.get.mockReturnValue({ toPromise: () => Promise.resolve(mockRes) } as any);
    repoMock.savePreview.mockResolvedValue(mockPreview);
    redisMock.set.mockResolvedValue('OK');

    const result = await service.fetchPreview('https://ex.com');
    expect(result.title).toBe('Test');
    expect(repoMock.savePreview).toHaveBeenCalled();
  });

  it('should block domain', async () => {
    jest.spyOn(require('../utils/blocked-domains'), 'isBlockedDomain').mockReturnValue(true);
    const result = await service.fetchPreview('http://blocked.com');
    expect(result).toBeNull();
  });

  it('should invalidate', async () => {
    redisMock.del.mockResolvedValue(1);
    repoMock.updateByUrl.mockResolvedValue({ affected: 1 });
    await service.invalidatePreview('https://ex.com');
    expect(redisMock.del).toHaveBeenCalled();
    expect(repoMock.updateByUrl).toHaveBeenCalled();
  });
});
