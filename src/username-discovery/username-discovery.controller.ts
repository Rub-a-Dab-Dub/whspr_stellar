import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  DiscoverUsersQueryDto,
  DiscoveryResultDto,
  PublicProfileCardDto,
} from './dto/username-discovery.dto';
import { UsernameDiscoveryService } from './username-discovery.service';

@ApiTags('discover')
@ApiBearerAuth()
@Controller('discover')
export class UsernameDiscoveryController {
  constructor(private readonly usernameDiscoveryService: UsernameDiscoveryService) {}

  @Get()
  @ApiOperation({ summary: 'Search users by username/displayName with privacy filters' })
  @ApiResponse({ status: 200, type: [DiscoveryResultDto] })
  discoverUsers(
    @CurrentUser('id') userId: string,
    @Query() query: DiscoverUsersQueryDto,
  ): Promise<DiscoveryResultDto[]> {
    return this.usernameDiscoveryService.discoverUsers(userId, query);
  }

  @Get('username/:username')
  @ApiOperation({ summary: 'Find a discoverable user by exact username' })
  @ApiParam({ name: 'username', description: 'Username to resolve' })
  @ApiResponse({ status: 200, type: DiscoveryResultDto })
  getByUsername(
    @CurrentUser('id') userId: string,
    @Param('username') username: string,
  ): Promise<DiscoveryResultDto> {
    return this.usernameDiscoveryService.getByUsername(userId, username);
  }

  @Get('wallet/:address')
  @ApiOperation({ summary: 'Find a discoverable user by wallet address' })
  @ApiParam({ name: 'address', description: 'Wallet address to resolve' })
  @ApiResponse({ status: 200, type: DiscoveryResultDto })
  getByWalletAddress(
    @CurrentUser('id') userId: string,
    @Param('address') walletAddress: string,
  ): Promise<DiscoveryResultDto> {
    return this.usernameDiscoveryService.getByWalletAddress(userId, walletAddress);
  }

  @Get(':username/card')
  @ApiOperation({ summary: 'Get a public profile card (cached for 60 seconds)' })
  @ApiResponse({ status: 200, type: PublicProfileCardDto })
  getPublicCard(
    @CurrentUser('id') userId: string,
    @Param('username') username: string,
  ): Promise<PublicProfileCardDto> {
    return this.usernameDiscoveryService.getPublicCard(userId, username);
  }

  @Get(':username/qr')
  @ApiOperation({ summary: 'Generate profile QR code with gasless://profile/:username deep link' })
  async getProfileQr(
    @Param('username') username: string,
    @Res() res: Response,
  ): Promise<void> {
    const png = await this.usernameDiscoveryService.getProfileQr(username);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(png);
  }
}
