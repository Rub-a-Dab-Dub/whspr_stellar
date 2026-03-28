import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
  CurrentUser,
} from '@nestjs/common';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoryResponseDto, PaginatedStoriesResponse } from './dto/story-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AuthGuard } from '@nestjs/passport'; // assume JWT auth
import { User } from '../users/entities/user.entity';

@Controller('stories')
@UseGuards(AuthGuard('jwt'))
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() createStoryDto: CreateStoryDto): Promise<StoryResponseDto> {
    return this.storiesService.createStory(user.id, createStoryDto);
  }

  @Get()
  async getContactStories(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedStoriesResponse> {
    const result = await this.storiesService.getContactStories(user.id, pagination);
    return result;
  }

  @Get('mine')
  async getMyStories(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedStoriesResponse> {
    const result = await this.storiesService.getMyStories(user.id, pagination);
    return result;
  }

  @Delete(':id')
  async deleteStory(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.storiesService.deleteStory(id, user.id);
  }

  @Get(':id/viewers')
  async getViewers(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<any[]> {
    return this.storiesService.getStoryViewers(id, user.id);
  }
}

