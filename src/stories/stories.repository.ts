import { Injectable } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { DataSource, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Repository } from 'typeorm';
import { Story } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { User } from '../../users/entities/user.entity';

import { StoryView } from './entities/story-view.entity';
import { CreateStoryDto } from './dto/create-story.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class StoriesRepository {

  constructor(
    private dataSource: DataSource,
  ) {}



  async createStory(userId: string, dto: CreateStoryDto): Promise<Story> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (dto.durationMs || 24 * 60 * 60 * 1000));
    
    const story = this.dataSource.getRepository(Story).create({
      userId,
      contentType: dto.contentType,
      content: dto.content,
      mediaUrl: dto.mediaUrl,
      backgroundColor: dto.backgroundColor,
      expiresAt,
    });

    return this.dataSource.getRepository(Story).save(story);
  }


  async countActiveByUser(userId: string): Promise<number> {
    return this.count({
      where: {
        userId,
        expiresAt: MoreThanOrEqual(new Date()),
      },
    });
  }

  // Removed duplicate - use countActiveByUser


  async getMyStories(
    userId: string, 
    pagination: PaginationDto & { limit?: number }
  ): Promise<[Story[], number]> {
    const { page = 1, limit = 30 } = pagination;
    const take = Math.min(limit, 50);
    const skip = (page - 1) * take;

    return this.findAndCount({
      where: {
        userId,
        expiresAt: MoreThanOrEqual(new Date()),
      },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
  }

  async getContactStories(
    viewerId: string,
    pagination: PaginationDto
  ): Promise<ContactStoriesResult> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    // Get viewer&#x27;s friends wallet addresses using raw query for perf
    const friendsWallets = await this.dataSource.query(
      `SELECT DISTINCT wallet_address FROM saved_addresses 
       WHERE user_id = $1 AND &#x27;friends&#x27;=ANY(tags)`,
      [viewerId]
    );

    if (friendsWallets.length === 0) {
      return { stories: [], total: 0 };
    }

    const walletAddresses = friendsWallets.map((w: any) => w.wallet_address);
    const stories = await this.dataSource.getRepository(Story).find({
      where: {
        user: { walletAddress: In(walletAddresses) },
        expiresAt: MoreThanOrEqual(new Date()),
      },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    const total = await this.dataSource.getRepository(Story).count({
      where: {
        user: { walletAddress: In(walletAddresses) },
        expiresAt: MoreThanOrEqual(new Date()),
      },
    });

    return { stories, total };
  }



  async recordView(storyId: string, viewerId: string, isCreator = false): Promise<void> {
    // Upsert view
    await this.dataSource.query(
      `INSERT INTO story_views (story_id, viewer_id, viewed_at, is_creator_view) 
       VALUES ($1, $2, NOW(), $3) 
       ON CONFLICT (story_id, viewer_id) DO NOTHING`,
      [storyId, viewerId, isCreator]
    );

    // Increment viewCount
    await this.increment({ id: storyId }, 'viewCount', 1);
  }


  async deleteExpired(): Promise<number> {
    const result = await this.delete({
      expiresAt: LessThanOrEqual(new Date()),
    });
    return result.affected ?? 0;
  }

  async getViewers(storyId: string): Promise<StoryView[]> {
    return this.dataSource.getRepository(StoryView).find({
      where: { storyId },
      order: { viewedAt: 'ASC' },
    });
  }

  async recordView(storyId: string, viewerId: string, isCreator = false): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO story_views (story_id, viewer_id, viewed_at, is_creator_view) 
       VALUES ($1, $2, NOW(), $3) 
       ON CONFLICT (story_id, viewer_id) DO NOTHING`,
      [storyId, viewerId, isCreator]
    );

    await this.dataSource.getRepository(Story).increment({ id: storyId }, 'viewCount', 1);
  }
}




