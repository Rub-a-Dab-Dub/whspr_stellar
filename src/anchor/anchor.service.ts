import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Anchor } from './entities/anchor.entity';
import { AnchorTransaction, AnchorTxType, AnchorTxStatus } from './entities/anchor-transaction.entity';
import {
  AnchorDto,
  AnchorRateDto,
  AnchorTransactionDto,
  InitiateDepositDto,
  InitiateWithdrawalDto,
  InitiateTransactionResponseDto,
} from './dto/anchor.dto';
import { CacheService } from '../cache/cache.service';

const ANCHOR_CACHE_TTL = 3600; // 1 hour
const POLL_TERMINAL = new Set([AnchorTxStatus.COMPLETED, AnchorTxStatus.FAILED, AnchorTxStatus.EXPIRED]);

const SEP24_STATUS_MAP: Record<string, AnchorTxStatus> = {
  pending_anchor: AnchorTxStatus.PROCESSING,
  pending_stellar: AnchorTxStatus.PROCESSING,
  pending_external: AnchorTxStatus.PROCESSING,
  pending_user: AnchorTxStatus.PENDING,
  completed: AnchorTxStatus.COMPLETED,
  error: AnchorTxStatus.FAILED,
  expired: AnchorTxStatus.EXPIRED,
  refunded: AnchorTxStatus.FAILED,
};

@Injectable()
export class AnchorService {
  private readonly logger = new Logger(AnchorService.name);

  constructor(
    @InjectRepository(Anchor)
    private readonly anchorRepo: Repository<Anchor>,
    @InjectRepository(AnchorTransaction)
    private readonly txRepo: Repository<AnchorTransaction>,
    private readonly http: HttpService,
    private readonly cache: CacheService,
  ) {}

  // ── Discovery ────────────────────────────────────────────────────────────────

  async discoverAnchors(): Promise<AnchorDto[]> {
    const cacheKey = 'anchors:all';
    return this.cache.getOrSet(cacheKey, ANCHOR_CACHE_TTL, async () => {
      const anchors = await this.anchorRepo.find({ where: { isActive: true } });
      return anchors.map((a) => this.toAnchorDto(a));
    });
  }

  async getAnchorInfo(id: string): Promise<AnchorDto> {
    const cacheKey = `anchors:${id}`;
    return this.cache.getOrSet(cacheKey, ANCHOR_CACHE_TTL, async () => {
      const anchor = await this.anchorRepo.findOne({ where: { id, isActive: true } });
      if (!anchor) throw new NotFoundException(`Anchor ${id} not found`);
      return this.toAnchorDto(anchor);
    });
  }

  async getAnchorForCurrency(currency: string): Promise<AnchorDto[]> {
    const cacheKey = `anchors:currency:${currency}`;
    return this.cache.getOrSet(cacheKey, ANCHOR_CACHE_TTL, async () => {
      const anchors = await this.anchorRepo.find({
        where: { currency: currency.toUpperCase(), isActive: true },
        order: { country: 'ASC' }, // NGN anchors (NG) surface first
      });
      return anchors.map((a) => this.toAnchorDto(a));
    });
  }

  // ── stellar.toml parsing ─────────────────────────────────────────────────────

  async parseAndCacheToml(anchorId: string): Promise<AnchorDto> {
    const anchor = await this.anchorRepo.findOne({ where: { id: anchorId } });
    if (!anchor) throw new NotFoundException(`Anchor ${anchorId} not found`);

    try {
      const tomlUrl = `https://${anchor.homeDomain}/.well-known/stellar.toml`;
      const { data } = await firstValueFrom(this.http.get<string>(tomlUrl));
      const seps = this.extractSEPs(data);
      anchor.supportedSEPs = seps;
      await this.anchorRepo.save(anchor);
      await this.cache.del(`anchors:${anchorId}`);
      await this.cache.del('anchors:all');
    } catch (err) {
      this.logger.warn(`Failed to parse stellar.toml for ${anchor.homeDomain}: ${(err as Error).message}`);
    }

    return this.toAnchorDto(anchor);
  }

  // ── Rates ────────────────────────────────────────────────────────────────────

  async getBestAnchorRate(from: string, to: string, amount = 100): Promise<AnchorRateDto[]> {
    const cacheKey = `anchors:rates:${from}:${to}`;
    return this.cache.getOrSet(cacheKey, 300, async () => {
      const anchors = await this.anchorRepo.find({ where: { isActive: true } });
      const rates = await Promise.allSettled(
        anchors.map((a) => this.fetchRate(a, from, to, amount)),
      );

      const results: AnchorRateDto[] = [];
      for (const r of rates) {
        if (r.status === 'fulfilled' && r.value) results.push(r.value);
      }

      // Sort: NGN corridor first, then by best estimated receive
      return results.sort((a, b) => {
        const aIsNGN = a.fromCurrency === 'NGN' || a.toCurrency === 'NGN' ? -1 : 0;
        const bIsNGN = b.fromCurrency === 'NGN' || b.toCurrency === 'NGN' ? -1 : 0;
        if (aIsNGN !== bIsNGN) return aIsNGN - bIsNGN;
        return b.estimatedReceive - a.estimatedReceive;
      });
    });
  }

  // ── Transactions ─────────────────────────────────────────────────────────────

  async initiateDeposit(
    userId: string,
    anchorId: string,
    dto: InitiateDepositDto,
  ): Promise<InitiateTransactionResponseDto> {
    const anchor = await this.anchorRepo.findOne({ where: { id: anchorId, isActive: true } });
    if (!anchor) throw new NotFoundException(`Anchor ${anchorId} not found`);

    const { txId, interactiveUrl } = await this.callSEP24Interactive(anchor, 'deposit', {
      asset_code: dto.assetCode,
      amount: dto.amount,
    });

    const tx = this.txRepo.create({
      userId,
      anchorId,
      type: AnchorTxType.DEPOSIT,
      assetCode: dto.assetCode,
      amount: dto.amount ?? null,
      fiatCurrency: dto.fiatCurrency ?? null,
      anchorTxId: txId,
      status: AnchorTxStatus.PENDING,
    });
    await this.txRepo.save(tx);

    return { id: tx.id, interactiveUrl, status: tx.status };
  }

  async initiateWithdrawal(
    userId: string,
    anchorId: string,
    dto: InitiateWithdrawalDto,
  ): Promise<InitiateTransactionResponseDto> {
    const anchor = await this.anchorRepo.findOne({ where: { id: anchorId, isActive: true } });
    if (!anchor) throw new NotFoundException(`Anchor ${anchorId} not found`);

    if (!dto.amount) throw new BadRequestException('amount is required for withdrawal');

    const { txId, interactiveUrl } = await this.callSEP24Interactive(anchor, 'withdraw', {
      asset_code: dto.assetCode,
      amount: dto.amount,
    });

    const tx = this.txRepo.create({
      userId,
      anchorId,
      type: AnchorTxType.WITHDRAWAL,
      assetCode: dto.assetCode,
      amount: dto.amount,
      fiatCurrency: dto.fiatCurrency ?? null,
      anchorTxId: txId,
      status: AnchorTxStatus.PENDING,
    });
    await this.txRepo.save(tx);

    return { id: tx.id, interactiveUrl, status: tx.status };
  }

  async pollTransactionStatus(txId: string): Promise<AnchorTransactionDto> {
    const tx = await this.txRepo.findOne({ where: { id: txId }, relations: ['anchor'] });
    if (!tx) throw new NotFoundException(`Transaction ${txId} not found`);

    if (!POLL_TERMINAL.has(tx.status)) {
      await this.syncFromAnchor(tx);
    }

    return this.toTxDto(tx);
  }

  /** Called by the scheduler every 30 seconds */
  async pollAllPending(): Promise<void> {
    const pending = await this.txRepo.find({
      where: [{ status: AnchorTxStatus.PENDING }, { status: AnchorTxStatus.PROCESSING }],
      relations: ['anchor'],
    });
    await Promise.allSettled(pending.map((tx) => this.syncFromAnchor(tx)));
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async callSEP24Interactive(
    anchor: Anchor,
    type: 'deposit' | 'withdraw',
    params: Record<string, string | undefined>,
  ): Promise<{ txId: string; interactiveUrl: string }> {
    const url = `https://${anchor.homeDomain}/sep24/transactions/${type}/interactive`;
    const { data } = await firstValueFrom(this.http.post<{ id: string; url: string }>(url, params));
    return { txId: data.id, interactiveUrl: data.url };
  }

  private async syncFromAnchor(tx: AnchorTransaction): Promise<void> {
    try {
      const domain = tx.anchor?.homeDomain;
      if (!domain) return;

      const url = `https://${domain}/sep24/transaction?id=${tx.anchorTxId}`;
      const { data } = await firstValueFrom(
        this.http.get<{ transaction: Record<string, unknown> }>(url),
      );
      const payload = data.transaction ?? data;

      const newStatus = SEP24_STATUS_MAP[payload['status'] as string] ?? tx.status;
      tx.status = newStatus;
      if (payload['stellar_transaction_id']) tx.stellarTxHash = payload['stellar_transaction_id'] as string;
      if (payload['amount_in']) tx.fiatAmount = payload['amount_in'] as string;

      await this.txRepo.save(tx);
    } catch (err) {
      this.logger.warn(`Failed to sync anchor tx ${tx.id}: ${(err as Error).message}`);
    }
  }

  private async fetchRate(
    anchor: Anchor,
    from: string,
    to: string,
    amount: number,
  ): Promise<AnchorRateDto | null> {
    try {
      const url = `https://${anchor.homeDomain}/sep38/price?sell_asset=${from}&buy_asset=${to}&sell_amount=${amount}`;
      const { data } = await firstValueFrom(
        this.http.get<{ price: string; fee: { total: string } }>(url),
      );
      const rate = parseFloat(data.price);
      const fee = parseFloat(data.fee?.total ?? '0');
      return {
        anchorId: anchor.id,
        anchorName: anchor.name,
        fromCurrency: from,
        toCurrency: to,
        rate,
        fee,
        estimatedReceive: amount * rate - fee,
      };
    } catch {
      return null;
    }
  }

  private extractSEPs(tomlContent: string): string[] {
    const match = tomlContent.match(/SUPPORTED_PROTOCOLS\s*=\s*\[([^\]]+)\]/);
    if (!match) return [];
    return match[1]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);
  }

  private toAnchorDto(a: Anchor): AnchorDto {
    return {
      id: a.id,
      name: a.name,
      homeDomain: a.homeDomain,
      currency: a.currency,
      country: a.country,
      supportedSEPs: a.supportedSEPs,
      isActive: a.isActive,
      logoUrl: a.logoUrl,
      feeStructure: a.feeStructure,
    };
  }

  private toTxDto(tx: AnchorTransaction): AnchorTransactionDto {
    return {
      id: tx.id,
      userId: tx.userId,
      anchorId: tx.anchorId,
      type: tx.type,
      assetCode: tx.assetCode,
      amount: tx.amount,
      fiatAmount: tx.fiatAmount,
      fiatCurrency: tx.fiatCurrency,
      stellarTxHash: tx.stellarTxHash,
      anchorTxId: tx.anchorTxId,
      status: tx.status,
      createdAt: tx.createdAt,
    };
  }
}
