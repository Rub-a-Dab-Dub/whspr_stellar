import axios from "axios";
import * as cheerio from "cheerio";
import Redis from "ioredis";
import { savePreview, findByUrl } from "./link-previews.repository";
import { sanitizeContent } from "../utils/sanitizer";
import { isBlockedDomain } from "../utils/blocked-domains";

const redis = new Redis();

export class LinkPreviewsService {
  async fetchPreview(url: string) {
    if (isBlockedDomain(url)) return null;

    const cached = await redis.get(url);
    if (cached) return JSON.parse(cached);

    try {
      const res = await axios.get(url, { timeout: 5000 });
      const $ = cheerio.load(res.data);

      const preview = {
        url,
        title: sanitizeContent($("meta[property='og:title']").attr("content") || $("title").text()),
        description: sanitizeContent($("meta[property='og:description']").attr("content") || $("meta[name='description']").attr("content")),
        imageUrl: $("meta[property='og:image']").attr("content") || $("meta[name='twitter:image']").attr("content"),
        favicon: $("link[rel='icon']").attr("href"),
        siteName: $("meta[property='og:site_name']").attr("content"),
        fetchedAt: new Date(),
        isFailed: false,
      };

      await savePreview(preview);
      await redis.set(url, JSON.stringify(preview), "EX", 60 * 60 * 24); // 24h TTL
      return preview;
    } catch {
      await savePreview({ url, isFailed: true, fetchedAt: new Date() });
      return null;
    }
  }

  async getPreview(url: string) {
    return findByUrl(url);
  }

  async invalidatePreview(url: string) {
    await redis.del(url);
  }
}
