import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './services/wallet.service';
import { QueueService } from '../queue/queue.service';
import { GenerateWalletDto, WalletResponseDto, ExportWalletDto } from './dto/wallet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly queueService: QueueService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate new wallet asynchronously' })
  async generateWallet(@Request() req, @Body() dto: GenerateWalletDto) {
    const userId = dto.userId || req.user.id;
    await this.queueService.addWalletCreationJob({ userId });
    return { message: 'Wallet generation queued', userId };
  }

  @Get()
  @ApiOperation({ summary: 'Get all user wallets' })
  async getWallets(@Request() req): Promise<WalletResponseDto[]> {
    const wallets = await this.walletService.getWalletsByUser(req.user.id);
    return wallets.map(w => ({
      id: w.id,
      address: w.address,
      balance: '0',
      isPrimary: w.isPrimary,
      createdAt: w.createdAt,
    }));
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Check wallet balance' })
  async getBalance(@Param('id') id: string) {
    const rpcUrl = process.env.EVM_RPC_URL || 'https://rpc.ankr.com/eth';
    const balance = await this.walletService.getBalance(id, rpcUrl);
    return { balance };
  }

  @Post(':id/export')
  @ApiOperation({ summary: 'Export wallet private key' })
  async exportWallet(@Param('id') id: string, @Request() req) {
    return this.walletService.exportWallet(id, req.user.id);
  }

  @Post('recover')
  @ApiOperation({ summary: 'Recover wallet from private key' })
  async recoverWallet(@Body('privateKey') privateKey: string, @Request() req) {
    const wallet = await this.walletService.recoverWallet(privateKey, req.user.id);
    return { id: wallet.id, address: wallet.address };
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  async getTransactions(@Param('id') id: string) {
    return this.walletService.getTransactionHistory(id);
  }

  @Post(':id/set-primary')
  @ApiOperation({ summary: 'Set wallet as primary' })
  async setPrimary(@Param('id') id: string, @Request() req) {
    await this.walletService.setPrimaryWallet(id, req.user.id);
    return { message: 'Primary wallet updated' };
  }
}
