import { Injectable } from '@nestjs/common';
import Filter from 'bad-words';

@Injectable()
export class ProfanityFilterService {
  private filter: Filter;

  constructor() {
    this.filter = new Filter();
  }

  /**
   * Check if text contains profanity
   */
  isProfane(text: string, customWords: string[] = []): boolean {
    if (customWords.length > 0) {
      this.filter.addWords(...customWords);
    }
    return this.filter.isProfane(text);
  }

  /**
   * Clean profanity from text
   */
  clean(text: string, customWords: string[] = []): string {
    if (customWords.length > 0) {
      this.filter.addWords(...customWords);
    }
    return this.filter.clean(text);
  }

  /**
   * Get profanity score (0-1)
   */
  getProfanityScore(text: string, customWords: string[] = []): number {
    const words = text.toLowerCase().split(/\s+/);
    const profaneWords = words.filter(word => 
      this.isProfane(word, customWords)
    );
    return profaneWords.length / Math.max(words.length, 1);
  }

  /**
   * Add custom words to filter
   */
  addWords(...words: string[]): void {
    this.filter.addWords(...words);
  }

  /**
   * Remove words from filter (whitelist)
   */
  removeWords(...words: string[]): void {
    this.filter.removeWords(...words);
  }
}