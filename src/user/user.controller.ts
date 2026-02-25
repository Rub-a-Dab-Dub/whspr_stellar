import { Controller, Get, Query, UseGuards, Post, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { AvatarService } from './services/avatar.service';
import { SearchUserDto, UserSearchResultDto } from './dto/search-user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly avatarService: AvatarService,
  ) {}

  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Search users by username or wallet address' })
  @ApiResponse({ status: 200, type: [UserSearchResultDto] })
  async searchUsers(@Query() dto: SearchUserDto): Promise<UserSearchResultDto[]> {
    return this.userService.searchUsers(dto.q);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ): Promise<{ avatarUrl: string; ipfsHash: string }> {
    return this.avatarService.uploadAvatar(req.user.id, file);
  }
}
