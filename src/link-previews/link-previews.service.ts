import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { LinkPreview } from './link-preview.entity';
import { LinkPreviewsRepository } from './link-previews.repository';
import { sanitizeContent } from '../utils/sanitizer';
import { isBlockedDomain } from '../utils/blocked-domains';
import { extractUrlsFromMessage } from '../utils/url-extractor';

@Injectable()
export class LinkPreviewsService {
  private readonly logger = new Logger(LinkPreviewsService.name);

  constructor(
    private readonly http: HttpService,
    private readonly repo: LinkPreviewsRepository,
    @InjectQueue('link-previews')
    private readonly queue: Queue,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  extractUrlsFromMessage(body: string): string[] {
    const urls = extractUrlsFromMessage(body);
    return [...new Set(urls.filter((u: string) => !isBlockedDomain(u)))];
  }

  async queuePreviewUrls(messageId: string, urls: string[]) {
    const jobs = urls.map((url) =>
      this.queue.add('fetch-preview', { url }, {
        jobId: `preview-${messageId}-${encodeURIComponent(url)}`,
        removeOnComplete: 10,
        removeOnFail: 5,
      }),
    );
    return Promise.all(jobs);
  }

  async getPreview(url: string): Promise<LinkPreview | null> {
    const key = `preview:${url}`;
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as LinkPreview;
    }

    const dbPreview = await this.repo.findByUrl(url);
    if (dbPreview && !dbPreview.isFailed) {
      const jsonStr = JSON.stringify(dbPreview);
      await this.redis.set(key, jsonStr, 'EX', 86400);
      return dbPreview;
    }
    return null;
  }

  async fetchPreview(url: string): Promise<LinkPreview | null> {
    if (isBlockedDomain(url)) {
      return null;
    }

    try {
      const response = await firstValueFrom(this.http.get(url, { timeout: 5000 }));
      const $ = cheerio.load(response.data);

      const preview: Partial<LinkPreview> = {
        url,
        title: sanitizeContent($("meta[property='og:title']").attr('content') || $("title").text().trim() || ''),
        description: sanitizeContent(
          $("meta[property='og:description']").attr('content') ||
            $("meta[name='description']").attr('content') ||
            ''
        ),
        imageUrl:
          $("meta[property='og:image']").attr('content') ||
          $("meta[name='twitter:image']").attr('content') ||
          null,
        favicon: $("link[rel='icon'], link[rel='shortcut icon']").attr('href') || null,
        siteName: $("meta[property='og:site_name']").attr('content') || null,
        fetchedAt: new Date(),
        isFailed: false,
      };

      const saved = await this.repo.savePreview(preview);
      const key = `preview:${url}`;
      await this.redis.set(key, JSON.stringify(saved), 'EX', 86400);
      return saved;
    } catch (error) {
      this.logger.error(`Failed to fetch preview for ${url}`, error);
      await this.repo.savePreview({ url, isFailed: true, fetchedAt: new Date() });
      return null;
    }
  }

  async invalidatePreview(url: string) {
    const key = `preview:${url}`;
    await this.redis.del(key);
    await this.repo.update({ url }, { isFailed: true });
  }
}
