import { Injectable } from '@nestjs/common';
import { DataSource, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Story } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { CreateStoryDto } from './dto/create-story.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

export interface ContactStoriesResult {
  stories: Story[];
  total: number;
}

@Injectable()
export class StoriesRepository {
  constructor(private readonly dataSource: DataSource) {}

  private get storyRepo(): Repository<Story> {
    return this.dataSource.getRepository(Story);
  }

  private get viewRepo(): Repository<StoryView> {
    return this.dataSource.getRepository(StoryView);
  }

  async createStory(userId: string, dto: CreateStoryDto): Promise<Story> {
    const now = new Date();
    const durationMs = dto.durationMs ?? 24 * 60 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + durationMs);

    const story = this.storyRepo.create({
      userId,
      contentType: dto.contentType,
      content: dto.content ?? null,
      mediaUrl: dto.mediaUrl ?? null,
      backgroundColor: dto.backgroundColor ?? null,
      duration: durationMs,
      expiresAt,
    });
    return this.storyRepo.save(story);
  }

  async findActiveByIdWithAuthor(storyId: string): Promise<Story | null> {
    return this.storyRepo.findOne({
      where: { id: storyId, expiresAt: MoreThanOrEqual(new Date()) },
      relations: ['user'],
    });
  }

  async findByIdAndUser(storyId: string, userId: string): Promise<Story | null> {
    return this.storyRepo.findOne({ where: { id: storyId, userId } });
  }

  async countActiveByUser(userId: string): Promise<number> {
    return this.storyRepo.count({
      where: {
        userId,
        expiresAt: MoreThanOrEqual(new Date()),
      },
    });
  }

  async getMyStories(userId: string, pagination: PaginationDto): Promise<[Story[], number]> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 30;
    const take = Math.min(limit, 50);
    const skip = (page - 1) * take;

    return this.storyRepo.findAndCount({
      where: {
        userId,
        expiresAt: MoreThanOrEqual(new Date()),
      },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
  }

  async getContactStories(viewerId: string, pagination: PaginationDto): Promise<ContactStoriesResult> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const friendsWallets: { walletAddress: string }[] = await this.dataSource.query(
      `SELECT DISTINCT "walletAddress" AS "walletAddress" FROM saved_addresses 
       WHERE "userId" = $1 AND 'friends' = ANY(tags)`,
      [viewerId],
    );

    if (friendsWallets.length === 0) {
      return { stories: [], total: 0 };
    }

    const walletAddresses = [...new Set(friendsWallets.map((w) => w.walletAddress))];

    const stories = await this.storyRepo
      .createQueryBuilder('story')
      .innerJoinAndSelect('story.user', 'user')
      .where('user.walletAddress IN (:...wallets)', { wallets: walletAddresses })
      .andWhere('story.expiresAt >= :now', { now: new Date() })
      .andWhere('story.userId != :viewerId', { viewerId })
      .orderBy('story.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const total = await this.storyRepo
      .createQueryBuilder('story')
      .innerJoin('story.user', 'user')
      .where('user.walletAddress IN (:...wallets)', { wallets: walletAddresses })
      .andWhere('story.expiresAt >= :now', { now: new Date() })
      .andWhere('story.userId != :viewerId', { viewerId })
      .getCount();

    return { stories, total };
  }

  /**
   * Inserts a view row if missing and increments story viewCount in one round-trip.
   * @returns new viewCount when a new view was recorded, otherwise null
   */
  async recordView(storyId: string, viewerId: string): Promise<number | null> {
    const rows = await this.dataSource.query(
      `WITH inserted AS (
        INSERT INTO "story_views" ("storyId", "viewerId", "viewedAt")
        VALUES ($1, $2, NOW())
        ON CONFLICT ("storyId", "viewerId") DO NOTHING
        RETURNING "storyId"
      )
      UPDATE "stories" s
      SET "viewCount" = s."viewCount" + 1
      FROM inserted i
      WHERE s.id = i."storyId"
      RETURNING s."viewCount" AS "viewCount"`,
      [storyId, viewerId],
    );
    const row = rows?.[0] as { viewCount: string | number } | undefined;
    if (row?.viewCount === undefined || row?.viewCount === null) {
      return null;
    }
    return typeof row.viewCount === 'string' ? parseInt(row.viewCount, 10) : row.viewCount;
  }

  async isContactOfAuthor(viewerId: string, authorWalletAddress: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM saved_addresses 
       WHERE "userId" = $1 AND LOWER("walletAddress") = LOWER($2) AND 'friends' = ANY(tags)
       LIMIT 1`,
      [viewerId, authorWalletAddress],
    );
    return rows.length > 0;
  }

  async getContactUserIdsForCreatorWallet(creatorWallet: string): Promise<string[]> {
    const rows: { userId: string }[] = await this.dataSource.query(
      `SELECT DISTINCT "userId" AS "userId" FROM saved_addresses
       WHERE LOWER("walletAddress") = LOWER($1) AND 'friends' = ANY(tags)`,
      [creatorWallet],
    );
    return rows.map((r) => r.userId);
  }

  async deleteStory(story: Story): Promise<void> {
    await this.storyRepo.remove(story);
  }

  async deleteExpired(): Promise<number> {
    const result = await this.storyRepo.delete({
      expiresAt: LessThanOrEqual(new Date()),
    });
    return result.affected ?? 0;
  }

  async getViewers(storyId: string): Promise<StoryView[]> {
    return this.viewRepo.find({
      where: { storyId },
      order: { viewedAt: 'ASC' },
    });
  }

  async findViewCountByStoryId(storyId: string): Promise<number | null> {
    const row = await this.storyRepo.findOne({
      where: { id: storyId },
      select: ['id', 'viewCount'],
    });
    return row?.viewCount ?? null;
  }
}
