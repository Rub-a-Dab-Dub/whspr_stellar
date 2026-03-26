import { Controller, Get, Post, Query, Param, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StickersService } from './stickers.service';
import { StickerResponseDto } from './dto/sticker-response.dto';
import { StickerPackResponseDto } from './dto/sticker-pack-response.dto';
import { GifResultDto } from './dto/gif-result.dto';
import { CreateStickerPackDto } from './dto/create-sticker-pack.dto';
import { CreateStickerDto } from './dto/create-sticker.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@ApiTags('Stickers & GIFs')
@Controller('stickers')
export class StickersController {
  constructor(private readonly stickersService: StickersService) {}

  @Get('packs')
  @ApiOperation({ summary: 'Get all sticker packs with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of sticker packs',
    type: PaginatedResponse<StickerPackResponseDto>,
  })
  async getStickerPacks(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<StickerPackResponseDto>> {
    return this.stickersService.getStickerPacks(pagination);
  }

  @Get('packs/official')
  @ApiOperation({ summary: 'Get official sticker packs only' })
  @ApiResponse({
    status: 200,
    description: 'List of official sticker packs',
    type: PaginatedResponse<StickerPackResponseDto>,
  })
  async getOfficialStickerPacks(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<StickerPackResponseDto>> {
    return this.stickersService.getOfficialStickerPacks(pagination);
  }

  @Get('packs/:id')
  @ApiOperation({ summary: 'Get sticker pack by ID with all stickers' })
  @ApiResponse({
    status: 200,
    description: 'Sticker pack with all stickers',
    type: StickerPackResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Sticker pack not found',
  })
  async getPackStickers(@Param('id') packId: string): Promise<StickerPackResponseDto> {
    return this.stickersService.getPackStickers(packId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search stickers by name and tags' })
  @ApiResponse({
    status: 200,
    description: 'List of matching stickers',
    type: [StickerResponseDto],
  })
  async searchStickers(@Query('q') query: string): Promise<StickerResponseDto[]> {
    return this.stickersService.searchStickers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single sticker by ID' })
  @ApiResponse({
    status: 200,
    description: 'Sticker details',
    type: StickerResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Sticker not found',
  })
  async getSticker(@Param('id') stickerId: string): Promise<StickerResponseDto> {
    return this.stickersService.getSticker(stickerId);
  }

  @Post('packs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create official sticker pack (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Sticker pack created',
    type: StickerPackResponseDto,
  })
  async createStickerPack(
    @Body() createDto: CreateStickerPackDto,
  ): Promise<StickerPackResponseDto> {
    return this.stickersService.addOfficialPack(createDto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add sticker to pack (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Sticker created',
    type: StickerResponseDto,
  })
  async createSticker(@Body() createDto: CreateStickerDto): Promise<StickerResponseDto> {
    return this.stickersService.addStickerToPack(createDto);
  }
}

@ApiTags('GIFs')
@Controller('gifs')
export class GifsController {
  constructor(private readonly stickersService: StickersService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search GIFs from Tenor API' })
  @ApiResponse({
    status: 200,
    description: 'List of GIFs',
    type: [GifResultDto],
  })
  async searchGifs(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ): Promise<GifResultDto[]> {
    return this.stickersService.searchGIFs(query, limit || 10);
  }
}
