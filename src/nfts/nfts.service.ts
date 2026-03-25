import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { NFT } from './entities/nft.entity';
import { NFTQueryFilters, NFTsRepository } from './repositories/nfts.repository';
import { Wallet, WalletNetwork } from '../wallets/entities/wallet.entity';

interface StellarAssetBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance?: string;
  limit?: string;
  is_authorized?: boolean;
}

interface HorizonAssetRecord {
  asset_type: string;
  asset_code: string;
  asset_issuer: string;
  amount?: string;
  num_accounts?: number;
  _links?: {
    toml?: {
      href?: string;
    };
  };
  flags?: Record<string, boolean>;
}

interface ResolvedNFTAsset {
  contractAddress: string;
  tokenId: string;
  metadata: Record<string, unknown>;
  imageUrl: string;
  name: string;
  collection: string;
  network: WalletNetwork;
}

interface ResolvedMetadata {
  metadata: Record<string, unknown>;
  imageUrl: string;
  name: string;
  collection: string;
}

@Injectable()
export class NFTsService implements OnModuleDestroy {
  private readonly logger = new Logger(NFTsService.name);
  private readonly metadataCacheTtlSeconds = 300;
  private readonly servers: Record<WalletNetwork, StellarSdk.Horizon.Server>;
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly nftsRepository: NFTsRepository,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {
    this.servers = {
      [WalletNetwork.STELLAR_MAINNET]: new StellarSdk.Horizon.Server(
        this.configService.get<string>(
          'STELLAR_HORIZON_MAINNET_URL',
          'https://horizon.stellar.org',
        ),
      ),
      [WalletNetwork.STELLAR_TESTNET]: new StellarSdk.Horizon.Server(
        this.configService.get<string>(
          'STELLAR_HORIZON_TESTNET_URL',
          'https://horizon-testnet.stellar.org',
        ),
      ),
    };

    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async syncUserNFTs(userId: string): Promise<NFT[]> {
    const [user, wallet] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.getPrimaryStellarWallet(userId),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const discoveredNFTs = await this.fetchWalletNFTs(
      wallet.walletAddress,
      wallet.network,
    );
    const syncedAt = new Date();
    const seenKeys = new Set<string>();
    const entitiesToSave: NFT[] = [];

    for (const discoveredNFT of discoveredNFTs) {
      const existingNFT = await this.nftsRepository.findByAsset(
        discoveredNFT.contractAddress,
        discoveredNFT.tokenId,
        discoveredNFT.network,
      );

      seenKeys.add(
        this.toAssetKey(
          discoveredNFT.contractAddress,
          discoveredNFT.tokenId,
          discoveredNFT.network,
        ),
      );

      const nft = this.nftsRepository.create({
        ...(existingNFT ?? {}),
        contractAddress: discoveredNFT.contractAddress,
        tokenId: discoveredNFT.tokenId,
        ownerId: userId,
        metadata: discoveredNFT.metadata,
        imageUrl: discoveredNFT.imageUrl,
        name: discoveredNFT.name,
        collection: discoveredNFT.collection,
        network: discoveredNFT.network,
        lastSyncedAt: syncedAt,
      });

      entitiesToSave.push(nft);
    }

    if (entitiesToSave.length > 0) {
      await this.nftsRepository.save(entitiesToSave);
    }

    const currentOwnedNFTs = await this.nftsRepository.findByOwnerId(userId, {
      network: wallet.network,
    });
    const staleNFTs = currentOwnedNFTs.filter(
      (nft) =>
        !seenKeys.has(
          this.toAssetKey(nft.contractAddress, nft.tokenId, nft.network),
        ),
    );

    if (staleNFTs.length > 0) {
      await this.nftsRepository.remove(staleNFTs);
    }

    return this.nftsRepository.findByOwnerId(userId, { network: wallet.network });
  }

  async getNFT(id: string, ownerId?: string): Promise<NFT> {
    const nft = ownerId
      ? await this.nftsRepository.findOwnedById(id, ownerId)
      : await this.nftsRepository.findOneById(id);

    if (!nft) {
      throw new NotFoundException('NFT not found');
    }

    return nft;
  }

  async getUserNFTs(
    ownerId: string,
    filters: NFTQueryFilters = {},
  ): Promise<NFT[]> {
    return this.nftsRepository.findByOwnerId(ownerId, filters);
  }

  async useAsAvatar(ownerId: string, nftId: string): Promise<User> {
    const [user, nft, wallet] = await Promise.all([
      this.userRepository.findOne({ where: { id: ownerId } }),
      this.getNFT(nftId, ownerId),
      this.getPrimaryStellarWallet(ownerId),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isOwner = await this.verifyOwnership(
      wallet.walletAddress,
      nft.contractAddress,
      nft.tokenId,
      nft.network,
    );

    if (!isOwner) {
      throw new ForbiddenException(
        'NFT ownership could not be verified on Stellar',
      );
    }

    user.avatarUrl = nft.imageUrl;

    return this.userRepository.save(user);
  }

  async verifyOwnership(
    ownerWalletAddress: string,
    contractAddress: string,
    tokenId: string,
    network: WalletNetwork = WalletNetwork.STELLAR_MAINNET,
  ): Promise<boolean> {
    try {
      const page = await this.getServer(network).accounts().forAsset(
        new StellarSdk.Asset(tokenId, contractAddress),
      ).call();
      const records = this.extractRecords<Record<string, unknown>>(page);

      return records.some((record) => {
        const accountId =
          typeof record.account_id === 'string'
            ? record.account_id
            : typeof record.id === 'string'
              ? record.id
              : null;

        return accountId === ownerWalletAddress;
      });
    } catch (error) {
      if (this.isHorizonNotFoundError(error)) {
        return false;
      }

      this.logger.error(
        `Failed to verify Stellar NFT ownership for ${tokenId}:${contractAddress}: ${this.getErrorMessage(error)}`,
      );
      return false;
    }
  }

  async getNFTsForGating(
    ownerId: string,
    filters: NFTQueryFilters = {},
  ): Promise<NFT[]> {
    await this.syncUserNFTs(ownerId);
    return this.nftsRepository.findForGating(ownerId, filters);
  }

  private async fetchWalletNFTs(
    walletAddress: string,
    network: WalletNetwork,
  ): Promise<ResolvedNFTAsset[]> {
    try {
      const account = await this.getServer(network).loadAccount(walletAddress);
      const balances = Array.isArray((account as any)?.balances)
        ? ((account as any).balances as StellarAssetBalance[])
        : [];

      const nfts = await Promise.all(
        balances
          .filter((balance) => this.isIssuedAsset(balance))
          .map((balance) => this.resolveBalanceToNFT(balance, network)),
      );

      return nfts.filter((nft): nft is ResolvedNFTAsset => nft !== null);
    } catch (error) {
      if (this.isHorizonNotFoundError(error)) {
        this.logger.warn(
          `Stellar account ${walletAddress} was not found during NFT sync`,
        );
        return [];
      }

      this.logger.error(
        `Failed to fetch Stellar NFTs for wallet ${walletAddress}: ${this.getErrorMessage(error)}`,
      );
      throw new BadRequestException('Failed to sync NFTs from Stellar Horizon');
    }
  }

  private async resolveBalanceToNFT(
    balance: StellarAssetBalance,
    network: WalletNetwork,
  ): Promise<ResolvedNFTAsset | null> {
    const assetCode = balance.asset_code;
    const assetIssuer = balance.asset_issuer;

    if (!assetCode || !assetIssuer) {
      return null;
    }

    const assetRecord = await this.fetchAssetRecord(
      assetCode,
      assetIssuer,
      network,
    );

    if (!assetRecord || !this.isNFTLikeAsset(balance, assetRecord)) {
      return null;
    }

    const resolvedMetadata = await this.resolveMetadata(assetRecord, network);

    return {
      contractAddress: assetIssuer,
      tokenId: assetCode,
      metadata: {
        ...resolvedMetadata.metadata,
        assetCode,
        assetIssuer,
        balance: balance.balance ?? null,
        limit: balance.limit ?? null,
        isAuthorized: balance.is_authorized ?? null,
      },
      imageUrl: resolvedMetadata.imageUrl,
      name: resolvedMetadata.name,
      collection: resolvedMetadata.collection,
      network,
    };
  }

  private async fetchAssetRecord(
    assetCode: string,
    assetIssuer: string,
    network: WalletNetwork,
  ): Promise<HorizonAssetRecord | null> {
    try {
      const page = await this.getServer(network)
        .assets()
        .forCode(assetCode)
        .forIssuer(assetIssuer)
        .limit(1)
        .call();
      const records = this.extractRecords<HorizonAssetRecord>(page);
      return records[0] ?? null;
    } catch (error) {
      if (this.isHorizonNotFoundError(error)) {
        return null;
      }

      this.logger.error(
        `Failed to fetch Horizon asset ${assetCode}:${assetIssuer}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  private async resolveMetadata(
    assetRecord: HorizonAssetRecord,
    network: WalletNetwork,
  ): Promise<ResolvedMetadata> {
    const cacheKey = `nfts:metadata:${network}:${assetRecord.asset_issuer}:${assetRecord.asset_code}`;
    const cachedValue = await this.getCachedValue(cacheKey);

    if (cachedValue) {
      try {
        return JSON.parse(cachedValue) as ResolvedMetadata;
      } catch (error) {
        this.logger.warn(`Failed to parse cached NFT metadata for ${cacheKey}`);
      }
    }

    const homeDomain = await this.getIssuerHomeDomain(assetRecord, network);
    const fallbackImageUrl = this.buildFallbackImageUrl(
      assetRecord.asset_code,
      assetRecord.asset_issuer,
    );

    const metadata: ResolvedMetadata = {
      imageUrl: fallbackImageUrl,
      name: assetRecord.asset_code,
      collection: homeDomain || assetRecord.asset_issuer,
      metadata: {
        canonicalAsset: `${assetRecord.asset_code}:${assetRecord.asset_issuer}`,
        asset: this.serializeAssetRecord(assetRecord),
        issuerHomeDomain: homeDomain || null,
      },
    };

    await this.setCachedValue(
      cacheKey,
      JSON.stringify(metadata),
      this.metadataCacheTtlSeconds,
    );

    return metadata;
  }

  private async getIssuerHomeDomain(
    assetRecord: HorizonAssetRecord,
    network: WalletNetwork,
  ): Promise<string | null> {
    try {
      const issuerAccount = await this.getServer(network).loadAccount(
        assetRecord.asset_issuer,
      );
      const homeDomain = (issuerAccount as unknown as { home_domain?: unknown })
        .home_domain;

      return typeof homeDomain === 'string' ? homeDomain : null;
    } catch (error) {
      this.logger.debug(
        `No issuer home domain found for ${assetRecord.asset_code}:${assetRecord.asset_issuer}`,
      );
      return null;
    }
  }

  private isIssuedAsset(balance: StellarAssetBalance): boolean {
    return (
      balance.asset_type !== 'native' &&
      typeof balance.asset_code === 'string' &&
      typeof balance.asset_issuer === 'string'
    );
  }

  private isNFTLikeAsset(
    balance: StellarAssetBalance,
    assetRecord: HorizonAssetRecord,
  ): boolean {
    const trustLineLimit = parseFloat(balance.limit ?? '0');
    const totalSupply = parseFloat(assetRecord.amount ?? '0');

    return (
      (Number.isFinite(trustLineLimit) && trustLineLimit <= 1) ||
      (Number.isFinite(totalSupply) && totalSupply <= 1)
    );
  }

  private toAssetKey(
    contractAddress: string,
    tokenId: string,
    network: string,
  ): string {
    return `${network}:${contractAddress}:${tokenId}`;
  }

  private extractRecords<T>(page: unknown): T[] {
    if (Array.isArray((page as any)?.records)) {
      return (page as any).records as T[];
    }

    if (Array.isArray((page as any)?._embedded?.records)) {
      return (page as any)._embedded.records as T[];
    }

    return [];
  }

  private serializeAssetRecord(
    assetRecord: HorizonAssetRecord,
  ): Record<string, unknown> {
    return {
      assetType: assetRecord.asset_type,
      assetCode: assetRecord.asset_code,
      assetIssuer: assetRecord.asset_issuer,
      amount: assetRecord.amount ?? null,
      numAccounts: assetRecord.num_accounts ?? null,
      flags: assetRecord.flags ?? null,
      tomlUrl: assetRecord._links?.toml?.href ?? null,
    };
  }

  private buildFallbackImageUrl(assetCode: string, assetIssuer: string): string {
    const hash = createHash('sha256')
      .update(`${assetCode}:${assetIssuer}`)
      .digest('hex');
    const primary = `#${hash.slice(0, 6)}`;
    const secondary = `#${hash.slice(6, 12)}`;
    const label = assetCode.slice(0, 12).toUpperCase();
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${label}">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${primary}" />
            <stop offset="100%" stop-color="${secondary}" />
          </linearGradient>
        </defs>
        <rect width="128" height="128" rx="24" fill="url(#bg)" />
        <text
          x="64"
          y="74"
          text-anchor="middle"
          fill="#ffffff"
          font-family="Verdana, sans-serif"
          font-size="24"
          font-weight="700"
        >
          ${label}
        </text>
      </svg>
    `.trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  private isHorizonNotFoundError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (((error as any).response?.status === 404) ||
        (error as any).status === 404 ||
        (error as any).name === 'NotFoundError')
    );
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private getServer(network: WalletNetwork): StellarSdk.Horizon.Server {
    const server = this.servers[network];

    if (!server) {
      throw new BadRequestException(`Unsupported Stellar network: ${network}`);
    }

    return server;
  }

  private async getPrimaryStellarWallet(userId: string): Promise<Wallet> {
    const wallet =
      (await this.walletRepository.findOne({
        where: {
          userId,
          network: WalletNetwork.STELLAR_MAINNET,
          isPrimary: true,
        },
        order: {
          createdAt: 'ASC',
        },
      })) ??
      (await this.walletRepository.findOne({
        where: {
          userId,
          network: WalletNetwork.STELLAR_TESTNET,
          isPrimary: true,
        },
        order: {
          createdAt: 'ASC',
        },
      })) ??
      (await this.walletRepository.findOne({
        where: {
          userId,
          network: WalletNetwork.STELLAR_MAINNET,
        },
        order: {
          isPrimary: 'DESC',
          createdAt: 'ASC',
        },
      })) ??
      (await this.walletRepository.findOne({
        where: {
          userId,
          network: WalletNetwork.STELLAR_TESTNET,
        },
        order: {
          isPrimary: 'DESC',
          createdAt: 'ASC',
        },
      }));

    if (!wallet) {
      throw new BadRequestException(
        'User does not have a linked Stellar wallet configured',
      );
    }

    return wallet;
  }

  private async getCachedValue(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.warn(`Failed to read NFT metadata cache for ${key}`);
      return null;
    }
  }

  private async setCachedValue(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Failed to write NFT metadata cache for ${key}`);
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
