import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  TooManyRequestsException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import { randomUUID } from 'crypto';
import { RedisService } from '../common/redis/redis.service';
import { SandboxEnvironment, SandboxTestWallet } from './entities/sandbox-environment.entity';
import {
  SandboxTransaction,
  SandboxTransactionStatus,
  SandboxTransactionType,
} from './entities/sandbox-transaction.entity';

const DAILY_SANDBOX_LIMIT = 1000;
const DEFAULT_FUNDED_AMOUNT = '10000.0000000';

@Injectable()
export class DeveloperSandboxService {
  constructor(
    @InjectRepository(SandboxEnvironment)
    private readonly sandboxRepository: Repository<SandboxEnvironment>,
    @InjectRepository(SandboxTransaction)
    private readonly sandboxTransactionRepository: Repository<SandboxTransaction>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async assertDailyApiLimit(userId: string): Promise<void> {
    const key = this.getDailyLimitKey(userId);

    try {
      const redis = this.redisService.getClient();
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 2 * 24 * 60 * 60);
      }

      if (count > DAILY_SANDBOX_LIMIT) {
        throw new TooManyRequestsException('Sandbox daily API call limit exceeded');
      }
    } catch (error) {
      if (error instanceof TooManyRequestsException) {
        throw error;
      }
      // Redis failures should not block sandbox operations.
    }
  }

  async createSandbox(userId: string): Promise<SandboxEnvironment> {
    const existing = await this.sandboxRepository.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }

    const sandbox = this.sandboxRepository.create({
      userId,
      apiKeyId: this.generateSandboxApiKeyId(),
      testWallets: [],
    });

    return this.sandboxRepository.save(sandbox);
  }

  async getSandbox(userId: string): Promise<SandboxEnvironment> {
    const sandbox = await this.sandboxRepository.findOne({ where: { userId } });
    if (!sandbox) {
      throw new NotFoundException('Sandbox environment not found');
    }
    return sandbox;
  }

  async resetSandbox(userId: string): Promise<{ completedInMs: number; success: boolean }> {
    const startedAt = Date.now();
    const sandbox = await this.getSandbox(userId);

    sandbox.testWallets = [];
    await this.sandboxRepository.save(sandbox);
    await this.sandboxTransactionRepository.delete({ environmentId: sandbox.id, userId });

    return {
      success: true,
      completedInMs: Date.now() - startedAt,
    };
  }

  async generateTestWallet(userId: string): Promise<SandboxTestWallet> {
    const sandbox = await this.getOrCreateSandbox(userId);
    const pair = StellarSdk.Keypair.random();

    const testWallet: SandboxTestWallet = {
      id: randomUUID(),
      publicKey: pair.publicKey(),
      secretKey: pair.secret(),
      funded: false,
      network: 'stellar_testnet',
      balance: '0.0000000',
      createdAt: new Date().toISOString(),
    };

    sandbox.testWallets = [...(sandbox.testWallets ?? []), testWallet];
    await this.sandboxRepository.save(sandbox);

    // Automatically fund on creation for developer ergonomics.
    await this.fundTestWallet(userId, testWallet.id, DEFAULT_FUNDED_AMOUNT);

    const updated = await this.getSandbox(userId);
    const funded = updated.testWallets.find((wallet) => wallet.id === testWallet.id);
    if (!funded) {
      throw new InternalServerErrorException('Failed to provision test wallet');
    }

    return funded;
  }

  async fundTestWallet(
    userId: string,
    walletId: string,
    amount = DEFAULT_FUNDED_AMOUNT,
  ): Promise<SandboxTransaction> {
    const sandbox = await this.getOrCreateSandbox(userId);
    const wallets = sandbox.testWallets ?? [];
    const index = wallets.findIndex((wallet) => wallet.id === walletId);

    if (index === -1) {
      throw new NotFoundException('Test wallet not found');
    }

    const wallet = wallets[index];
    const friendbotResult = await this.requestFriendbotFunding(wallet.publicKey);

    const nextBalance = (Number(wallet.balance || '0') + Number(amount)).toFixed(7);
    wallets[index] = {
      ...wallet,
      funded: true,
      balance: nextBalance,
    };

    sandbox.testWallets = wallets;
    await this.sandboxRepository.save(sandbox);

    const transaction = this.sandboxTransactionRepository.create({
      environmentId: sandbox.id,
      userId,
      walletAddress: wallet.publicKey,
      asset: 'XLM',
      amount,
      network: 'stellar_testnet',
      friendbotTxHash: friendbotResult.transactionHash,
      type: SandboxTransactionType.FRIEND_BOT_FUND,
      status: friendbotResult.success
        ? SandboxTransactionStatus.COMPLETED
        : SandboxTransactionStatus.FAILED,
      isSandbox: true,
      errorMessage: friendbotResult.errorMessage,
    });

    return this.sandboxTransactionRepository.save(transaction);
  }

  async clearTestData(userId: string): Promise<void> {
    const sandbox = await this.sandboxRepository.findOne({ where: { userId } });
    if (!sandbox) {
      return;
    }

    await this.sandboxTransactionRepository.delete({ environmentId: sandbox.id, userId });
    await this.sandboxRepository.delete({ id: sandbox.id, userId });
  }

  async getSandboxTransactions(userId: string): Promise<SandboxTransaction[]> {
    const sandbox = await this.getSandbox(userId);
    return this.sandboxTransactionRepository.find({
      where: { environmentId: sandbox.id, userId, isSandbox: true },
      order: { createdAt: 'DESC' },
    });
  }

  private async getOrCreateSandbox(userId: string): Promise<SandboxEnvironment> {
    const existing = await this.sandboxRepository.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }

    return this.createSandbox(userId);
  }

  private generateSandboxApiKeyId(): string {
    return `sbx_${randomUUID().replace(/-/g, '')}`;
  }

  private getDailyLimitKey(userId: string): string {
    const now = new Date();
    const day = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
      now.getUTCDate(),
    ).padStart(2, '0')}`;
    return `sandbox:limit:${userId}:${day}`;
  }

  private async requestFriendbotFunding(
    address: string,
  ): Promise<{ success: boolean; transactionHash: string | null; errorMessage: string | null }> {
    if (process.env.NODE_ENV === 'test') {
      return {
        success: true,
        transactionHash: `friendbot_test_${Date.now()}`,
        errorMessage: null,
      };
    }

    const baseUrl = this.configService.get<string>(
      'STELLAR_FRIENDBOT_URL',
      'https://friendbot.stellar.org',
    );
    const response = await fetch(`${baseUrl}/?addr=${encodeURIComponent(address)}`);

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        transactionHash: null,
        errorMessage: body || 'Friendbot funding failed',
      };
    }

    const payload = (await response.json()) as { hash?: string; result_meta_xdr?: string };
    return {
      success: true,
      transactionHash: payload.hash ?? null,
      errorMessage: null,
    };
  }
}
