import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { AddWalletDto } from './dto/add-wallet.dto';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { BalanceResponseDto } from './dto/balance-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class VerifyWalletDto {
  @ApiProperty({ description: 'Base64-encoded signature of the verification message' })
  @IsString()
  @IsNotEmpty()
  signature!: string;
}

@ApiTags('wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'List all wallets for the authenticated user' })
  @ApiResponse({ status: 200, type: [WalletResponseDto] })
  getWallets(@CurrentUser('id') userId: string): Promise<WalletResponseDto[]> {
    return this.walletsService.getWalletsByUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Link a new Stellar wallet' })
  @ApiResponse({ status: 201, type: WalletResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid address or wallet cap reached' })
  @ApiResponse({ status: 401, description: 'Signature verification failed' })
  @ApiResponse({ status: 409, description: 'Wallet already linked' })
  addWallet(
    @CurrentUser('id') userId: string,
    @Body() dto: AddWalletDto,
  ): Promise<WalletResponseDto> {
    return this.walletsService.addWallet(userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a linked wallet' })
  @ApiParam({ name: 'id', description: 'Wallet UUID' })
  @ApiResponse({ status: 204, description: 'Wallet removed' })
  @ApiResponse({ status: 400, description: 'Cannot remove primary while others exist' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  removeWallet(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) walletId: string,
  ): Promise<void> {
    return this.walletsService.removeWallet(userId, walletId);
  }

  @Patch(':id/primary')
  @ApiOperation({ summary: 'Set a wallet as primary' })
  @ApiParam({ name: 'id', description: 'Wallet UUID' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  setPrimary(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) walletId: string,
  ): Promise<WalletResponseDto> {
    return this.walletsService.setPrimary(userId, walletId);
  }

  @Patch(':id/verify')
  @ApiOperation({ summary: 'Verify wallet ownership via signature' })
  @ApiParam({ name: 'id', description: 'Wallet UUID' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  verifyWallet(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) walletId: string,
    @Body() dto: VerifyWalletDto,
  ): Promise<WalletResponseDto> {
    return this.walletsService.verifyWallet(userId, walletId, dto.signature);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get Stellar balance for a wallet (cached 30s)' })
  @ApiParam({ name: 'id', description: 'Wallet UUID' })
  @ApiResponse({ status: 200, type: BalanceResponseDto })
  @ApiResponse({ status: 404, description: 'Wallet or Stellar account not found' })
  getBalance(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) walletId: string,
  ): Promise<BalanceResponseDto> {
    return this.walletsService.getBalance(userId, walletId);
  }
}
