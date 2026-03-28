import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { StoryResponseDto } from './story-response.dto';

export type PaginatedStoriesResponse = PaginatedResponse<StoryResponseDto>;

