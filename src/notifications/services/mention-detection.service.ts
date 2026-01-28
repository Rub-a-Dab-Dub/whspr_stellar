import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export interface MentionMatch {
  userId: string;
  username: string;
  startIndex: number;
  endIndex: number;
}

@Injectable()
export class MentionDetectionService {
  private readonly logger = new Logger(MentionDetectionService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Extract mentions from message content
   */
  extractMentions(content: string): MentionMatch[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: MentionMatch[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push({
        userId: '', // Will be filled by validateMentions
        username: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return mentions;
  }

  /**
   * Validate mentions against existing users and return valid ones
   */
  async validateMentions(mentions: MentionMatch[]): Promise<MentionMatch[]> {
    if (mentions.length === 0) return [];

    const usernames = mentions.map(m => m.username);
    
    // Find users by username (assuming username field exists in User entity)
    const users = await this.userRepository.find({
      where: {
        username: In(usernames),
      },
      select: ['id', 'username'],
    });

    const userMap = new Map(users.map(user => [user.username, user.id]));

    return mentions
      .filter(mention => userMap.has(mention.username))
      .map(mention => ({
        ...mention,
        userId: userMap.get(mention.username)!,
      }));
  }

  /**
   * Extract and validate mentions in one step
   */
  async extractAndValidateMentions(content: string): Promise<MentionMatch[]> {
    const mentions = this.extractMentions(content);
    return this.validateMentions(mentions);
  }

  /**
   * Replace mentions in content with formatted mentions
   */
  formatMentions(content: string, mentions: MentionMatch[]): string {
    let formattedContent = content;
    
    // Sort mentions by start index in descending order to avoid index shifting
    const sortedMentions = [...mentions].sort((a, b) => b.startIndex - a.startIndex);

    for (const mention of sortedMentions) {
      const beforeMention = formattedContent.substring(0, mention.startIndex);
      const afterMention = formattedContent.substring(mention.endIndex);
      const formattedMention = `<@${mention.userId}>`;
      
      formattedContent = beforeMention + formattedMention + afterMention;
    }

    return formattedContent;
  }

  /**
   * Get user IDs from mentions
   */
  getMentionedUserIds(mentions: MentionMatch[]): string[] {
    return mentions.map(mention => mention.userId);
  }

  /**
   * Check if content contains mentions
   */
  hasMentions(content: string): boolean {
    const mentionRegex = /@\w+/;
    return mentionRegex.test(content);
  }

  /**
   * Get mention count in content
   */
  getMentionCount(content: string): number {
    const mentions = this.extractMentions(content);
    return mentions.length;
  }
}