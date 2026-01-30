import { Injectable } from '@nestjs/common';
import { Filter } from 'bad-words';

@Injectable()
export class ProfanityFilterService {
  private readonly filter = new Filter();

  /**
   * Check if content contains profanity
   */
  containsProfanity(content: string): boolean {
    return this.filter.isProfane(content);
  }

  /**
   * Get cleaned content with profanity replaced
   */
  clean(content: string): string {
    return this.filter.clean(content);
  }

  /**
   * Get all flagged words in content
   */
  getFlaggedWords(content: string): string[] {
    const words = content.toLowerCase().split(/\s+/);
    return words.filter((word) => this.filter.isProfane(word));
  }

  /**
   * Add custom words to filter
   */
  addWords(...words: string[]): void {
    this.filter.addWords(...words);
  }

  /**
   * Remove words from filter
   */
  removeWords(...words: string[]): void {
    this.filter.removeWords(...words);
  }
}
