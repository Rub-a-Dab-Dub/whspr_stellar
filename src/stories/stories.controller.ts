import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoryResponseDto, StoryViewDto } from './dto/story-response.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';

@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() createStoryDto: CreateStoryDto,
  ): Promise<StoryResponseDto> {
    return this.storiesService.createStory(userId, createStoryDto);
  }

  @Get()
  async getContactStories(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<StoryResponseDto>> {
    return this.storiesService.getContactStories(userId, pagination);
  }

  @Get('mine')
  async getMyStories(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<StoryResponseDto>> {
    return this.storiesService.getMyStories(userId, pagination);
  }

  @Post(':id/view')
  @HttpCode(200)
  async recordView(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ viewCount: number }> {
    return this.storiesService.viewStory(id, userId);
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteStory(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.storiesService.deleteStory(id, userId);
  }

  @Get(':id/viewers')
  async getViewers(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StoryViewDto[]> {
    return this.storiesService.getStoryViewers(id, userId);
  }
}
