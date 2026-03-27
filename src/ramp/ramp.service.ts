import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RampTransaction, RampType, RampStatus } from './entities/ramp-transaction.entity';
import { InitDepositDto, InitWithdrawalDto } from './dto/ramp-request.dto';
import { InitRampResponseDto, RampTransactionDto } from './dto/ramp-response.dto';
import { WalletsRepository } from '../wallets/wallets.repository';

@Injectable()
export class RampService {
  private readonly logger = new Logger(RampService.name);
  private readonly anchorBaseUrl: string;
  private readonly anchorApiKey: string;

  constructor(
    @InjectRepository(RampTransaction)
    private readonly rampRepo: Repository<RampTransaction>,
    private readonly walletsRepo: WalletsRepository,
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.anchorBaseUrl = this.config.get<string>('SEP24_ANCHOR_URL') ?? '';
    this.anchorApiKey = this.config.get<string>('SEP24_ANCHOR_API_KEY') ?? '';
  }

  async initDeposit(userId: string, dto: InitDepositDto): Promise<InitRampResponseDto> {
    const { anchorId, interactiveUrl } = await this.callAnchorInteractive('deposit', {
      asset_code: dto.assetCode,
      amount: dto.amount,
    });

    const tx = this.rampRepo.create({
      userId,
      type: RampType.DEPOSIT,
      assetCode: dto.assetCode,
      amount: dto.amount ?? null,
      fiatCurrency: dto.fiatCurrency ?? null,
      status: RampStatus.PENDING,
      anchorId,
      anchorUrl: interactiveUrl,
    });
    await this.rampRepo.save(tx);

    return { id: tx.id, anchorUrl: interactiveUrl, status: tx.status };
  }

  async initWithdrawal(userId: string, dto: InitWithdrawalDto): Promise<InitRampResponseDto> {
    const wallet = await this.walletsRepo.findPrimaryByUserId(userId);
    if (!wallet) throw new BadRequestException('No primary wallet found');

    const { anchorId, interactiveUrl } = await this.callAnchorInteractive('withdraw', {
      asset_code: dto.assetCode,
      amount: dto.amount,
      account: wallet.walletAddress,
    });

    const tx = this.rampRepo.create({
      userId,
      type: RampType.WITHDRAWAL,
      assetCode: dto.assetCode,
      amount: dto.amount,
      fiatCurrency: dto.fiatCurrency ?? null,
      status: RampStatus.PENDING,
      anchorId,
      anchorUrl: interactiveUrl,
    });
    await this.rampRepo.save(tx);

    return { id: tx.id, anchorUrl: interactiveUrl, status: tx.status };
  }

  async checkStatus(userId: string, id: string): Promise<RampTransactionDto> {
    const tx = await this.findOwned(userId, id);

    if (tx.anchorId && ![RampStatus.COMPLETED, RampStatus.FAILED, RampStatus.EXPIRED].includes(tx.status)) {
      await this.syncFromAnchor(tx);
    }

    return this.toDto(tx);
  }

  async getTransactions(userId: string): Promise<RampTransactionDto[]> {
    const txs = await this.rampRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return txs.map((t) => this.toDto(t));
  }

  /** Called by the polling job — syncs all non-terminal pending transactions */
  async pollPendingTransactions(): Promise<void> {
    const pending = await this.rampRepo.find({
      where: [{ status: RampStatus.PENDING }, { status: RampStatus.PROCESSING }],
    });

    await Promise.allSettled(pending.map((tx) => this.syncFromAnchor(tx)));
  }

  /** Handle anchor webhook callback */
  async handleCallback(payload: Record<string, unknown>): Promise<void> {
    const anchorId = payload['id'] as string | undefined;
    if (!anchorId) return;

    const tx = await this.rampRepo.findOne({ where: { anchorId } });
    if (!tx) return;

    await this.applyAnchorStatus(tx, payload);
  }

  // ── private helpers ──────────────────────────────────────────────────────

  private async callAnchorInteractive(
    type: 'deposit' | 'withdraw',
    params: Record<string, string | undefined>,
  ): Promise<{ anchorId: string; interactiveUrl: string }> {
    const url = `${this.anchorBaseUrl}/sep24/transactions/${type}/interactive`;
    const { data } = await firstValueFrom(
      this.http.post(url, params, {
        headers: { Authorization: `Bearer ${this.anchorApiKey}` },
      }),
    );
    return { anchorId: data.id, interactiveUrl: data.url };
  }

  private async syncFromAnchor(tx: RampTransaction): Promise<void> {
    try {
      const url = `${this.anchorBaseUrl}/sep24/transaction?id=${tx.anchorId}`;
      const { data } = await firstValueFrom(
        this.http.get(url, {
          headers: { Authorization: `Bearer ${this.anchorApiKey}` },
        }),
      );
      await this.applyAnchorStatus(tx, data.transaction ?? data);
    } catch (err) {
      this.logger.warn(`Failed to sync ramp tx ${tx.id}: ${(err as Error).message}`);
    }
  }

  private async applyAnchorStatus(
    tx: RampTransaction,
    data: Record<string, unknown>,
  ): Promise<void> {
    const statusMap: Record<string, RampStatus> = {
      pending_anchor: RampStatus.PROCESSING,
      pending_stellar: RampStatus.PROCESSING,
      pending_external: RampStatus.PROCESSING,
      pending_user: RampStatus.PENDING,
      completed: RampStatus.COMPLETED,
      error: RampStatus.FAILED,
      expired: RampStatus.EXPIRED,
      refunded: RampStatus.FAILED,
    };

    const newStatus = statusMap[data['status'] as string] ?? tx.status;
    tx.status = newStatus;
    if (data['stellar_transaction_id']) tx.txHash = data['stellar_transaction_id'] as string;
    if (data['amount_in']) tx.fiatAmount = data['amount_in'] as string;

    await this.rampRepo.save(tx);

    if (newStatus === RampStatus.COMPLETED && tx.type === RampType.DEPOSIT) {
      await this.creditWallet(tx);
    }
  }

  private async creditWallet(tx: RampTransaction): Promise<void> {
    // Mark wallet as verified/active after confirmed deposit — balance is live on-chain
    this.logger.log(`Deposit confirmed for user ${tx.userId}, asset ${tx.assetCode}, tx ${tx.txHash}`);
  }

  private async findOwned(userId: string, id: string): Promise<RampTransaction> {
    const tx = await this.rampRepo.findOne({ where: { id, userId } });
    if (!tx) throw new NotFoundException('Ramp transaction not found');
    return tx;
  }

  private toDto(tx: RampTransaction): RampTransactionDto {
    return {
      id: tx.id,
      userId: tx.userId,
      type: tx.type,
      assetCode: tx.assetCode,
      amount: tx.amount,
      fiatAmount: tx.fiatAmount,
      fiatCurrency: tx.fiatCurrency,
      status: tx.status,
      anchorId: tx.anchorId,
      anchorUrl: tx.anchorUrl,
      txHash: tx.txHash,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
  }
}
