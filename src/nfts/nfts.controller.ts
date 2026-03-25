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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueryUserNFTsDto } from './dto/query-user-nfts.dto';
import { NFTsService } from './nfts.service';

@Controller('nfts')
@UseGuards(JwtAuthGuard)
export class NFTsController {
  constructor(private readonly nftsService: NFTsService) {}

  @Get()
  async getUserNFTs(
    @CurrentUser() currentUser: any,
    @Query() query: QueryUserNFTsDto,
  ) {
    const { refresh, ...filters } = query;

    if (refresh === 'true') {
      await this.nftsService.syncUserNFTs(currentUser.userId);
    }

    return this.nftsService.getUserNFTs(currentUser.userId, filters);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncUserNFTs(@CurrentUser() currentUser: any) {
    const nfts = await this.nftsService.syncUserNFTs(currentUser.userId);

    return {
      success: true,
      count: nfts.length,
      data: nfts,
    };
  }

  @Get(':id')
  async getNFT(
    @CurrentUser() currentUser: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.nftsService.getNFT(id, currentUser.userId);
  }

  @Post(':id/use-as-avatar')
  @HttpCode(HttpStatus.OK)
  async useAsAvatar(
    @CurrentUser() currentUser: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const user = await this.nftsService.useAsAvatar(currentUser.userId, id);

    return {
      success: true,
      nftId: id,
      avatarUrl: user.profile?.avatarUrl ?? null,
    };
  }
}
