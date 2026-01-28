import { Injectable } from '@nestjs/common';
import * as natural from 'natural';

@Injectable()
export class SpamDetectionService {
  private readonly URL_REGEX = /(https?:\/\/[^\s]+)/g;
  private readonly REPEATED_CHARS_REGEX = /(.)\1{4,}/g;
  private readonly EXCESSIVE_CAPS_REGEX = /[A-Z]{5,}/g;

  /**
   * Detect if message is spam
   */
  isSpam(text: string, threshold: number = 0.7): boolean {
    const score = this.calculateSpamScore(text);
    return score >= threshold;
  }

  /**
   * Calculate spam score (0-1)
   */
  calculateSpamScore(text: string): number {
    let score = 0;
    const factors: number[] = [];

    // Factor 1: Excessive URLs (0-0.3)
    const urlCount = (text.match(this.URL_REGEX) || []).length;
    factors.push(Math.min(urlCount / 3, 0.3));

    // Factor 2: Repeated characters (0-0.2)
    const repeatedChars = (text.match(this.REPEATED_CHARS_REGEX) || []).length;
    factors.push(Math.min(repeatedChars / 3, 0.2));

    // Factor 3: Excessive capitals (0-0.2)
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    factors.push(Math.min(capsRatio, 0.2));

    // Factor 4: Message length anomaly (0-0.15)
    if (text.length > 500) {
      factors.push(0.15);
    } else {
      factors.push(0);
    }

    // Factor 5: Repetitive words (0-0.15)
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = 1 - (uniqueWords.size / words.length);
    factors.push(Math.min(repetitionRatio, 0.15));

    score = factors.reduce((sum, factor) => sum + factor, 0);
    return Math.min(score, 1);
  }

  /**
   * Detect link spam
   */
  isLinkSpam(text: string, whitelistedDomains: string[] = []): boolean {
    const urls = text.match(this.URL_REGEX) || [];
    
    if (urls.length === 0) return false;
    if (urls.length > 3) return true; // More than 3 links = spam

    // Check against whitelisted domains
    for (const url of urls) {
      const isWhitelisted = whitelistedDomains.some(domain => 
        url.includes(domain)
      );
      if (!isWhitelisted) return true;
    }

    return false;
  }

  /**
   * Extract URLs from text
   */
  extractUrls(text: string): string[] {
    return text.match(this.URL_REGEX) || [];
  }
}