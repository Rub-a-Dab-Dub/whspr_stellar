import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  FundSandboxWalletDto,
  SandboxEnvironmentResponseDto,
  SandboxTransactionResponseDto,
} from './dto/sandbox.dto';
import { DeveloperSandboxService } from './developer-sandbox.service';

@ApiTags('sandbox')
@ApiBearerAuth()
@Controller('sandbox')
export class DeveloperSandboxController {
  constructor(private readonly sandboxService: DeveloperSandboxService) {}

  @Post()
  @ApiOperation({ summary: 'Create developer sandbox environment' })
  @ApiResponse({ status: 201, type: SandboxEnvironmentResponseDto })
  async createSandbox(@CurrentUser('id') userId: string): Promise<SandboxEnvironmentResponseDto> {
    await this.sandboxService.assertDailyApiLimit(userId);
    return this.sandboxService.createSandbox(userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get sandbox environment details' })
  @ApiResponse({ status: 200, type: SandboxEnvironmentResponseDto })
  async getSandbox(@CurrentUser('id') userId: string): Promise<SandboxEnvironmentResponseDto> {
    await this.sandboxService.assertDailyApiLimit(userId);
    return this.sandboxService.getSandbox(userId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get all sandbox transactions' })
  @ApiResponse({ status: 200, type: [SandboxTransactionResponseDto] })
  async getSandboxTransactions(
    @CurrentUser('id') userId: string,
  ): Promise<SandboxTransactionResponseDto[]> {
    await this.sandboxService.assertDailyApiLimit(userId);
    return this.sandboxService.getSandboxTransactions(userId);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset sandbox state and clear all test data' })
  async resetSandbox(@CurrentUser('id') userId: string): Promise<{ completedInMs: number; success: boolean }> {
    await this.sandboxService.assertDailyApiLimit(userId);
    return this.sandboxService.resetSandbox(userId);
  }

  @Post('wallets')
  @ApiOperation({ summary: 'Generate and auto-fund a Stellar testnet wallet' })
  async generateTestWallet(@CurrentUser('id') userId: string): Promise<Record<string, unknown>> {
    await this.sandboxService.assertDailyApiLimit(userId);
    const wallet = await this.sandboxService.generateTestWallet(userId);
    return wallet;
  }

  @Post('wallets/:id/fund')
  @ApiOperation({ summary: 'Fund a sandbox wallet through Stellar Friendbot' })
  @ApiParam({ name: 'id', description: 'Sandbox test wallet id' })
  @ApiResponse({ status: 200, type: SandboxTransactionResponseDto })
  async fundTestWallet(
    @CurrentUser('id') userId: string,
    @Param('id') walletId: string,
    @Body() dto: FundSandboxWalletDto,
  ): Promise<SandboxTransactionResponseDto> {
    await this.sandboxService.assertDailyApiLimit(userId);
    return this.sandboxService.fundTestWallet(userId, walletId, dto.amount);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete sandbox environment and all sandbox data' })
  async clearSandbox(@CurrentUser('id') userId: string): Promise<void> {
    await this.sandboxService.assertDailyApiLimit(userId);
    await this.sandboxService.clearTestData(userId);
  }
}
