import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { SearchUserDto, UserSearchResultDto } from './dto/search-user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Search users by username or wallet address' })
  @ApiResponse({ status: 200, type: [UserSearchResultDto] })
  async searchUsers(@Query() dto: SearchUserDto): Promise<UserSearchResultDto[]> {
    return this.userService.searchUsers(dto.q);
  }
}
