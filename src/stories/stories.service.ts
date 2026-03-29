import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { StoriesRepository } from './stories.repository';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoryResponseDto, StoryViewDto } from './dto/story-response.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { UsersService } from '../users/users.service';
import { StoriesGateway } from './stories.gateway';
import { ContentType, Story } from './entities/story.entity';

@Injectable()
export class StoriesService {
  constructor(
    private readonly storiesRepository: StoriesRepository,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => StoriesGateway))
    private readonly storiesGateway: StoriesGateway,
  ) {}

  async createStory(userId: string, dto: CreateStoryDto): Promise<StoryResponseDto> {
    this.assertCreatePayload(dto);

    const activeCount = await this.storiesRepository.countActiveByUser(userId);
    if (activeCount >= 30) {
      throw new BadRequestException('Max 30 active stories allowed');
    }

    const story = await this.storiesRepository.createStory(userId, dto);
    const owner = await this.usersService.findById(userId, userId);
    const response = this.toStoryResponse(story, owner.username, owner.avatarUrl ?? null);

    const contactIds = await this.storiesRepository.getContactUserIdsForCreatorWallet(
      owner.walletAddress,
    );
    this.storiesGateway.emitNewStoryToContactFeeds(contactIds, response);

    return response;
  }

  async getContactStories(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<StoryResponseDto>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { stories, total } = await this.storiesRepository.getContactStories(userId, pagination);

    const data = await Promise.all(
      stories.map(async (story) => {
        const author = await this.usersService.findById(story.userId, userId);
        return this.toStoryResponse(story, author.username, author.avatarUrl ?? null);
      }),
    );

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async getMyStories(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<StoryResponseDto>> {
    const page = pagination.page ?? 1;
    const limit = Math.min(pagination.limit ?? 30, 50);
    const [stories, total] = await this.storiesRepository.getMyStories(userId, pagination);

    const owner = await this.usersService.findById(userId, userId);

    const data: StoryResponseDto[] = [];
    for (const story of stories) {
      const viewers = await this.storiesRepository.getViewers(story.id);
      const myViews: StoryViewDto[] = viewers.map((v) => ({
        viewerId: v.viewerId,
        viewedAt: v.viewedAt,
      }));
      data.push({
        ...this.toStoryResponse(story, owner.username, owner.avatarUrl ?? null),
        myViews,
      });
    }

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async viewStory(storyId: string, viewerId: string): Promise<{ viewCount: number }> {
    const story = await this.storiesRepository.findActiveByIdWithAuthor(storyId);
    if (!story) {
      throw new NotFoundException('Story not found or expired');
    }

    if (story.userId === viewerId) {
      const count = await this.storiesRepository.findViewCountByStoryId(storyId);
      return { viewCount: count ?? story.viewCount };
    }

    const authorWallet = story.user?.walletAddress;
    if (!authorWallet) {
      throw new NotFoundException('Story not found or expired');
    }

    const allowed = await this.storiesRepository.isContactOfAuthor(viewerId, authorWallet);
    if (!allowed) {
      throw new ForbiddenException('You cannot view this story');
    }

    const newCount = await this.storiesRepository.recordView(storyId, viewerId);
    if (newCount !== null) {
      this.storiesGateway.emitStoryViewCount(story.userId, storyId, newCount);
      return { viewCount: newCount };
    }

    const count = await this.storiesRepository.findViewCountByStoryId(storyId);
    return { viewCount: count ?? 0 };
  }

  async deleteStory(storyId: string, userId: string): Promise<void> {
    const story = await this.storiesRepository.findByIdAndUser(storyId, userId);
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    await this.storiesRepository.deleteStory(story);
  }

  async getStoryViewers(storyId: string, userId: string): Promise<StoryViewDto[]> {
    const story = await this.storiesRepository.findByIdAndUser(storyId, userId);
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const viewers = await this.storiesRepository.getViewers(storyId);
    return viewers.map((v) => ({ viewerId: v.viewerId, viewedAt: v.viewedAt }));
  }

  async deleteExpired(): Promise<number> {
    return this.storiesRepository.deleteExpired();
  }

  private assertCreatePayload(dto: CreateStoryDto): void {
    if (dto.contentType === ContentType.TEXT && !dto.content?.trim()) {
      throw new BadRequestException('Text stories require content');
    }
    if (
      (dto.contentType === ContentType.IMAGE || dto.contentType === ContentType.VIDEO) &&
      !dto.mediaUrl
    ) {
      throw new BadRequestException('Image and video stories require mediaUrl');
    }
  }

  private toStoryResponse(
    story: Story,
    username: string | null,
    avatarUrl: string | null,
  ): StoryResponseDto {
    return plainToInstance(StoryResponseDto, {
      ...story,
      username: username ?? '',
      avatarUrl,
    });
  }
}
