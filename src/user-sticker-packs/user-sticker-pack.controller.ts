import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AddUserStickerDto,
  BrowseUserStickerPacksQueryDto,
  CreateUserStickerPackDto,
  DownloadPackResponseDto,
  UserStickerPackResponseDto,
  UserStickerResponseDto,
} from './dto/user-sticker-pack.dto';
import { UserStickerPackService } from './user-sticker-pack.service';
import { MAX_STICKER_UPLOAD_BYTES } from './user-sticker-packs.constants';

@ApiTags('UGC sticker packs')
@Controller('sticker-packs')
export class UserStickerPackController {
  constructor(private readonly packs: UserStickerPackService) {}

  @Get('browse')
  @ApiOperation({ summary: 'Browse approved public sticker packs' })
  @ApiResponse({ status: 200 })
  async browsePublicPacks(@Query() query: BrowseUserStickerPacksQueryDto): Promise<{
    items: UserStickerPackResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.packs.browsePublicPacks(query.page, query.limit);
  }

  @Get('library')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stickers available to you (your packs + downloaded public packs)' })
  @ApiResponse({ status: 200, type: [UserStickerResponseDto] })
  async getLibrary(@CurrentUser('id') userId: string): Promise<UserStickerResponseDto[]> {
    return this.packs.getUserLibraryStickers(userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List your sticker packs' })
  @ApiResponse({ status: 200, type: [UserStickerPackResponseDto] })
  async listMine(@CurrentUser('id') userId: string): Promise<UserStickerPackResponseDto[]> {
    return this.packs.listMyPacks(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get sticker pack (creator always; others if public or downloaded)' })
  @ApiResponse({ status: 200, type: UserStickerPackResponseDto })
  async getPack(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<UserStickerPackResponseDto> {
    return this.packs.getPack(id, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a sticker pack (tier pack limits apply)' })
  @ApiResponse({ status: 201, type: UserStickerPackResponseDto })
  async createPack(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateUserStickerPackDto,
  ): Promise<UserStickerPackResponseDto> {
    return this.packs.createPack(userId, dto);
  }

  @Post(':id/stickers')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_STICKER_UPLOAD_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Add sticker (multipart file and/or fileKey after presigned upload)' })
  @ApiResponse({ status: 201, type: UserStickerResponseDto })
  async addSticker(
    @Param('id', ParseUUIDPipe) packId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddUserStickerDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UserStickerResponseDto> {
    return this.packs.addSticker(packId, userId, dto, file);
  }

  @Delete(':id/stickers/:stickerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a sticker from your pack' })
  @ApiResponse({ status: 204 })
  async removeSticker(
    @Param('id', ParseUUIDPipe) packId: string,
    @Param('stickerId', ParseUUIDPipe) stickerId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.packs.removeSticker(packId, stickerId, userId);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish pack (enters moderation queue; not public until approved)' })
  @ApiResponse({ status: 200, type: UserStickerPackResponseDto })
  async publishPack(
    @Param('id', ParseUUIDPipe) packId: string,
    @CurrentUser('id') userId: string,
  ): Promise<UserStickerPackResponseDto> {
    return this.packs.publishPack(packId, userId);
  }

  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unpublish your pack' })
  @ApiResponse({ status: 200, type: UserStickerPackResponseDto })
  async unpublishPack(
    @Param('id', ParseUUIDPipe) packId: string,
    @CurrentUser('id') userId: string,
  ): Promise<UserStickerPackResponseDto> {
    return this.packs.unpublishPack(packId, userId);
  }

  @Post(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download free pack into your library' })
  @ApiResponse({ status: 200, type: DownloadPackResponseDto })
  async downloadPack(
    @Param('id', ParseUUIDPipe) packId: string,
    @CurrentUser('id') userId: string,
  ): Promise<DownloadPackResponseDto> {
    return this.packs.downloadPack(packId, userId);
  }
}
