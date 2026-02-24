import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { RoleGuard } from '../../roles/guards/role.guard';
import { Roles } from '../../roles/decorators/roles.decorator';
import { UserRole } from '../../roles/entities/role.entity';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminWalletsService } from '../services/admin-wallets.service';
import { GetAdminWalletsDto } from '../dto/get-admin-wallets.dto';
import { SyncWalletsDto } from '../dto/sync-wallets.dto';

@ApiTags('admin-wallets')
@ApiBearerAuth()
@UseGuards(RoleGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/wallets')
export class AdminWalletsController {
  constructor(private readonly adminWalletsService: AdminWalletsService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated list of all user wallets' })
  @ApiResponse({ status: 200, description: 'Wallet list with filters' })
  async listWallets(
    @Query() query: GetAdminWalletsDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return this.adminWalletsService.listWallets(
      query,
      this.resolveActorId(currentUser),
      req,
    );
  }

  @Get(':walletAddress')
  @ApiOperation({ summary: 'Get single wallet details' })
  @ApiResponse({ status: 200, description: 'Wallet details' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getWallet(
    @Param('walletAddress') walletAddress: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return this.adminWalletsService.getWalletDetail(
      walletAddress,
      this.resolveActorId(currentUser),
      req,
    );
  }

  @Post(':userId/retry-creation')
  @ApiOperation({ summary: 'Retry failed wallet creation for a user' })
  @ApiResponse({ status: 200, description: 'Wallet creation re-queued' })
  @ApiResponse({ status: 409, description: 'Wallet already active' })
  async retryCreation(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return this.adminWalletsService.retryWalletCreation(
      userId,
      this.resolveActorId(currentUser),
      req,
    );
  }

  @Post('sync')
  @ApiOperation({ summary: 'Trigger async wallet balance sync job' })
  @ApiResponse({ status: 201, description: 'Sync job created' })
  async syncWallets(
    @Body() dto: SyncWalletsDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    return this.adminWalletsService.syncWallets(
      dto,
      this.resolveActorId(currentUser),
      req,
    );
  }

  private resolveActorId(currentUser: any): string {
    return currentUser?.adminId || currentUser?.userId || currentUser?.id;
  }
}
