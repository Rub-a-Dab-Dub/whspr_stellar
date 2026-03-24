import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { plainToInstance } from 'class-transformer';
import { WalletsRepository } from './wallets.repository';
import { HorizonService } from './services/horizon.service';
import { CryptoService } from '../auth/services/crypto.service';
import { AddWalletDto } from './dto/add-wallet.dto';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { BalanceResponseDto } from './dto/balance-response.dto';
import { Wallet, WalletNetwork } from './entities/wallet.entity';

const BALANCE_CACHE_TTL_MS = 30_000; // 30 seconds
const MAX_WALLETS_PER_USER = 10;

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    private readonly walletsRepository: WalletsRepository,
    private readonly horizonService: HorizonService,
    private readonly cryptoService: CryptoService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getWalletsByUser(userId: string): Promise<WalletResponseDto[]> {
    const wallets = await this.walletsRepository.findByUserId(userId);
    return wallets.map((w) => this.toDto(w));
  }

  async addWallet(userId: string, dto: AddWalletDto): Promise<WalletResponseDto> {
    const { walletAddress, network = WalletNetwork.STELLAR_MAINNET, label, signature } = dto;

    // Validate Stellar address format
    if (!this.horizonService.isValidAddress(walletAddress)) {
      throw new BadRequestException('Invalid Stellar wallet address');
    }

    // Enforce per-user wallet cap
    const count = await this.walletsRepository.countByUserId(userId);
    if (count >= MAX_WALLETS_PER_USER) {
      throw new BadRequestException(`Maximum of ${MAX_WALLETS_PER_USER} wallets per user`);
    }

    // Prevent duplicate wallet per user
    const existing = await this.walletsRepository.findByUserAndAddress(userId, walletAddress);
    if (existing) {
      throw new ConflictException('Wallet already linked to your account');
    }

    // Verify ownership via signature if provided
    let isVerified = false;
    if (signature) {
      const message = this.horizonService.buildVerificationMessage(walletAddress, userId);
      isVerified = this.cryptoService.verifyStellarSignature(walletAddress, message, signature);
      if (!isVerified) {
        throw new UnauthorizedException('Wallet signature verification failed');
      }
    }

    // First wallet becomes primary automatically
    const isPrimary = count === 0;

    const wallet = this.walletsRepository.create({
      userId,
      walletAddress,
      network,
      label: label ?? null,
      isVerified,
      isPrimary,
    });

    const saved = await this.walletsRepository.save(wallet);
    this.logger.log(`Wallet added: ${walletAddress} for user ${userId}`);
    return this.toDto(saved);
  }

  async removeWallet(userId: string, walletId: string): Promise<void> {
    const wallet = await this.walletsRepository.findByUserAndId(userId, walletId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.isPrimary) {
      const total = await this.walletsRepository.countByUserId(userId);
      if (total > 1) {
        throw new BadRequestException(
          'Cannot remove primary wallet while other wallets exist. Designate a new primary first.',
        );
      }
    }

    await this.walletsRepository.remove(wallet);
    await this.invalidateBalanceCache(wallet.walletAddress, wallet.network);
    this.logger.log(`Wallet removed: ${walletId} for user ${userId}`);
  }

  async setPrimary(userId: string, walletId: string): Promise<WalletResponseDto> {
    const wallet = await this.walletsRepository.findByUserAndId(userId, walletId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.isPrimary) {
      return this.toDto(wallet); // already primary — idempotent
    }

    await this.walletsRepository.transferPrimary(userId, walletId);

    const updated = await this.walletsRepository.findByUserAndId(userId, walletId);
    return this.toDto(updated!);
  }

  async verifyWallet(
    userId: string,
    walletId: string,
    signature: string,
  ): Promise<WalletResponseDto> {
    const wallet = await this.walletsRepository.findByUserAndId(userId, walletId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.isVerified) {
      return this.toDto(wallet); // idempotent
    }

    const message = this.horizonService.buildVerificationMessage(wallet.walletAddress, userId);
    const valid = this.cryptoService.verifyStellarSignature(wallet.walletAddress, message, signature);

    if (!valid) {
      throw new UnauthorizedException('Wallet signature verification failed');
    }

    wallet.isVerified = true;
    const saved = await this.walletsRepository.save(wallet);
    return this.toDto(saved);
  }

  async getBalance(
    userId: string,
    walletId: string,
  ): Promise<BalanceResponseDto> {
    const wallet = await this.walletsRepository.findByUserAndId(userId, walletId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const cacheKey = this.balanceCacheKey(wallet.walletAddress, wallet.network);
    const cached = await this.cache.get<BalanceResponseDto>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const balances = await this.horizonService.getBalances(wallet.walletAddress, wallet.network);

    const result: BalanceResponseDto = {
      walletAddress: wallet.walletAddress,
      balances,
      fetchedAt: new Date().toISOString(),
      cached: false,
    };

    await this.cache.set(cacheKey, result, BALANCE_CACHE_TTL_MS);
    return result;
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private toDto(wallet: Wallet): WalletResponseDto {
    return plainToInstance(WalletResponseDto, wallet, { excludeExtraneousValues: true });
  }

  private balanceCacheKey(address: string, network: WalletNetwork): string {
    return `balance:${network}:${address}`;
  }

  private async invalidateBalanceCache(address: string, network: WalletNetwork): Promise<void> {
    await this.cache.del(this.balanceCacheKey(address, network));
  }
}
