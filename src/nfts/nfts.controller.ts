import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QueryUserNFTsDto } from './dto/query-user-nfts.dto';
import { NFTsService } from './nfts.service';

@Controller('nfts')
@UseGuards(JwtAuthGuard)
export class NFTsController {
  constructor(private readonly nftsService: NFTsService) {}

  @Get()
  async getUserNFTs(
    @CurrentUser('id') userId: string,
    @Query() query: QueryUserNFTsDto,
  ) {
    const { refresh, ...filters } = query;

    if (refresh === 'true') {
      await this.nftsService.syncUserNFTs(userId);
    }

    return this.nftsService.getUserNFTs(userId, filters);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncUserNFTs(@CurrentUser('id') userId: string) {
    const nfts = await this.nftsService.syncUserNFTs(userId);

    return {
      success: true,
      count: nfts.length,
      data: nfts,
    };
  }

  @Get(':id')
  async getNFT(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.nftsService.getNFT(id, userId);
  }

  @Post(':id/use-as-avatar')
  @HttpCode(HttpStatus.OK)
  async useAsAvatar(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const user = await this.nftsService.useAsAvatar(userId, id);

    return {
      success: true,
      nftId: id,
      avatarUrl: user.avatarUrl ?? null,
    };
  }
}
