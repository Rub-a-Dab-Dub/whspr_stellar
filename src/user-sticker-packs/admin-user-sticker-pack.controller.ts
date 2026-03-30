import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UserStickerPackResponseDto } from './dto/user-sticker-pack.dto';
import { UserStickerPackService } from './user-sticker-pack.service';

@ApiTags('Admin — UGC sticker packs')
@Controller('admin/sticker-packs')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminUserStickerPackController {
  constructor(private readonly packs: UserStickerPackService) {}

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve pack for public listing' })
  @ApiResponse({ status: 200, type: UserStickerPackResponseDto })
  async approve(
    @Param('id', ParseUUIDPipe) packId: string,
  ): Promise<UserStickerPackResponseDto> {
    return this.packs.adminApprovePack(packId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject pack (unpublishes)' })
  @ApiResponse({ status: 200, type: UserStickerPackResponseDto })
  async reject(
    @Param('id', ParseUUIDPipe) packId: string,
  ): Promise<UserStickerPackResponseDto> {
    return this.packs.adminRejectPack(packId);
  }

  @Post(':id/moderate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Re-queue AI image moderation for pack' })
  @ApiResponse({ status: 204 })
  async moderate(@Param('id', ParseUUIDPipe) packId: string): Promise<void> {
    await this.packs.moderatePack(packId);
  }
}
