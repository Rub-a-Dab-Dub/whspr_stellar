import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { StoriesRepository } from './stories.repository';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoryResponseDto } from './dto/story-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../users/dto/user-response.dto';

@Injectable()
export class StoriesService {
  constructor(
    private readonly storiesRepository: StoriesRepository,
    private readonly usersService: UsersService,
  ) {}

  async createStory(userId: string, dto: CreateStoryDto): Promise<StoryResponseDto> {
    // Check 30 max active
    const activeCount = await this.storiesRepository.countActiveByUser(userId);
    if (activeCount >= 30) {
      throw new BadRequestException('Max 30 active stories allowed');
    }

    const story = await this.storiesRepository.createStory(userId, dto);

    // Populate user info
    const user = await this.usersService.findById(userId, userId); // owner view

    const response = plainToInstance(StoryResponseDto, {
      ...story,
      username: user.username,
      avatarUrl: user.avatarUrl,
    });

    // Emit WS to contacts (inject gateway or event emitter later)
    this.emitToContacts(userId, response);

    return response;
  }

  async getContactStories(
    userId: string,
    pagination: PaginationDto,
  ): Promise<{ stories: StoryResponseDto[]; total: number }> {
    const { stories, total } = await this.storiesRepository.getContactStories(userId, pagination);

    // Populate user info for each
    const populatedStories = await Promise.all(
      stories.map(async (story) => {
        const user = await this.usersService.findById(story.userId, userId);
        return plainToInstance(StoryResponseDto, {
          ...story,
          username: user.username,
          avatarUrl: user.avatarUrl,
        });
      }),
    );

    return { stories: populatedStories, total };
  }

  async getMyStories(
    userId: string,
    pagination: PaginationDto,
  ): Promise<{ stories: StoryResponseDto[]; total: number }> {
    const [stories, total] = await this.storiesRepository.getMyStories(userId, pagination);

    const populatedStories = await Promise.all(
      stories.map(async (story) => {
        const user = await this.usersService.findById(story.userId, userId);
        const viewers = await this.storiesRepository.getViewers(story.id); // for owner
        return plainToInstance(StoryResponseDto, {
          ...story,
          username: user.username,
          avatarUrl: user.avatarUrl,
          myViews: viewers.map(v => ({ viewerId: v.viewerId, viewedAt: v.viewedAt })),
        });
      }),
    );

    return { stories: populatedStories, total };
  }

  async viewStory(storyId: string, viewerId: string): Promise<void> {
    // Optional: check if story exists and not expired
    const story = await this.storiesRepository.findOne({
      where: { id: storyId, expiresAt: MoreThanOrEqual(new Date()) },
    });
    if (!story) {
      throw new NotFoundException('Story not found or expired');
    }

    await this.storiesRepository.recordView(storyId, viewerId);
  }

  async deleteStory(storyId: string, userId: string): Promise<void> {
    const story = await this.storiesRepository.findOne({ where: { id: storyId, userId } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    await this.storiesRepository.remove(story);
  }

  async getStoryViewers(storyId: string, userId: string): Promise<StoryResponseDto['myViews']> {
    const story = await this.storiesRepository.findOne({ where: { id: storyId, userId } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const viewers = await this.storiesRepository.getViewers(storyId);
    return viewers.map(v => ({ viewerId: v.viewerId, viewedAt: v.viewedAt }));
  }

  private emitToContacts(userId: string, story: StoryResponseDto): void {
    // Call gateway emit
    const gateway = this.storiesGateway;
    gateway.emitNewStoryToContacts(userId, story);
  }

}

