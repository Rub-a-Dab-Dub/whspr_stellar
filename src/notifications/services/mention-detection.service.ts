import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';

export interface MentionMatch {
  userId: string;
  username: string;
  startIndex: number;
  endIndex: number;
}

@Injectable()
export class MentionDetectionService {
  private readonly logger = new Logger(MentionDetectionService.name);
  private readonly MENTION_REGEX = /@([a-zA-Z0-9_.-]+)/g;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Extract mentions from message content
   */
  async extractMentions(content: string): Promise<MentionMatch[]> {
    const mentions: MentionMatch[] = [];
    const matches = Array.from(content.matchAll(this.MENTION_REGEX));

    if (matches.length === 0) {
      return mentions;
    }

    // Extract unique usernames
    const usernames = Array.from(new Set(matches.map(match => match[1])));

    // Find users by username/email
    const users = await this.userRepository.find({
      where: usernames.map(username => [
        { email: username },
        { email: `${username}@*` }, // Partial email match
      ]).flat(),
      select: ['id', 'email'],
    });

    // Create mention matches
    for (const match of matches) {
      const username = match[1];
      const user = users.find(u => 
        u.email === username || 
        u.email.startsWith(`${username}@`)
      );

      if (user) {
        mentions.push({
          userId: user.id,
          username: username,
          startIndex: match.index!,
          endIndex: match.index! + match[0].length,
        });
      }
    }

    this.logger.debug(`Found ${mentions.length} valid mentions in message`);
    return mentions;
  }

  /**
   * Replace mentions in content with formatted mentions
   */
  formatMentions(content: string, mentions: MentionMatch[]): string {
    let formattedContent = content;
    
    // Sort mentions by start index in descending order to avoid index shifting
    const sortedMentions = mentions.sort((a, b) => b.startIndex - a.startIndex);

    for (const mention of sortedMentions) {
      const beforeMention = formattedContent.substring(0, mention.startIndex);
      const afterMention = formattedContent.substring(mention.endIndex);
      const formattedMention = `<@${mention.userId}>`;
      
      formattedContent = beforeMention + formattedMention + afterMention;
    }

    return formattedContent;
  }

  /**
   * Check if content contains mentions
   */
  hasMentions(content: string): boolean {
    return this.MENTION_REGEX.test(content);
  }

  /**
   * Get mention count in content
   */
  getMentionCount(content: string): number {
    const matches = content.match(this.MENTION_REGEX);
    return matches ? matches.length : 0;
  }
}