import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { User } from '../user/entities/user.entity';
import { UserProfile } from '../user/entities/user-profile.entity';
import { NFT } from './entities/nft.entity';
import { NFTQueryFilters, NFTsRepository } from './repositories/nfts.repository';

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
  network: string;
}

interface ResolvedMetadata {
  metadata: Record<string, unknown>;
  imageUrl: string;
  name: string;
  collection: string;
}

interface StellarTomlCurrency {
  code?: string;
  issuer?: string;
  name?: string;
  image?: string;
  desc?: string;
  conditions?: string;
  [key: string]: unknown;
}

@Injectable()
export class NFTsService {
  private readonly logger = new Logger(NFTsService.name);
  private readonly metadataCacheTtlSeconds = 300;
  private readonly network = 'stellar';
  private readonly server: StellarSdk.Horizon.Server;
  private readonly networkPassphrase: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly nftsRepository: NFTsRepository,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
  ) {
    const horizonUrl =
      this.configService.get<string>('STELLAR_HORIZON_URL') ||
      'https://horizon-testnet.stellar.org';

    this.server = new StellarSdk.Horizon.Server(horizonUrl);
    this.networkPassphrase =
      this.configService.get<string>('STELLAR_NETWORK_PASSPHRASE') ||
      StellarSdk.Networks.TESTNET;
  }

  async syncUserNFTs(userId: string): Promise<NFT[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.walletAddress) {
      throw new BadRequestException(
        'User does not have a Stellar wallet configured',
      );
    }

    const discoveredNFTs = await this.fetchWalletNFTs(user.walletAddress);
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
      network: this.network,
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

    return this.nftsRepository.findByOwnerId(userId, { network: this.network });
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
    const [user, nft] = await Promise.all([
      this.userRepository.findOne({ where: { id: ownerId } }),
      this.getNFT(nftId, ownerId),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.walletAddress) {
      throw new BadRequestException(
        'User does not have a Stellar wallet configured',
      );
    }

    const isOwner = await this.verifyOwnership(
      user.walletAddress,
      nft.contractAddress,
      nft.tokenId,
      nft.network,
    );

    if (!isOwner) {
      throw new ForbiddenException(
        'NFT ownership could not be verified on Stellar',
      );
    }

    user.profile = this.buildUpdatedProfile(user.profile, nft.imageUrl);

    return this.userRepository.save(user);
  }

  async verifyOwnership(
    ownerWalletAddress: string,
    contractAddress: string,
    tokenId: string,
    network: string = this.network,
  ): Promise<boolean> {
    if (network !== this.network) {
      return false;
    }

    try {
      const page = await this.server.accounts().forAsset(
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
        `Failed to verify Stellar NFT ownership for ${tokenId}:${contractAddress}: ${error.message}`,
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
  ): Promise<ResolvedNFTAsset[]> {
    try {
      const account = await this.server.accounts().accountId(walletAddress).call();
      const balances = Array.isArray((account as any)?.balances)
        ? ((account as any).balances as StellarAssetBalance[])
        : [];

      const nfts = await Promise.all(
        balances
          .filter((balance) => this.isIssuedAsset(balance))
          .map((balance) => this.resolveBalanceToNFT(balance)),
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
        `Failed to fetch Stellar NFTs for wallet ${walletAddress}: ${error.message}`,
      );
      throw new BadRequestException('Failed to sync NFTs from Stellar Horizon');
    }
  }

  private async resolveBalanceToNFT(
    balance: StellarAssetBalance,
  ): Promise<ResolvedNFTAsset | null> {
    const assetCode = balance.asset_code;
    const assetIssuer = balance.asset_issuer;

    if (!assetCode || !assetIssuer) {
      return null;
    }

    const assetRecord = await this.fetchAssetRecord(assetCode, assetIssuer);

    if (!assetRecord || !this.isNFTLikeAsset(balance, assetRecord)) {
      return null;
    }

    const resolvedMetadata = await this.resolveMetadata(assetRecord);

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
      network: this.network,
    };
  }

  private async fetchAssetRecord(
    assetCode: string,
    assetIssuer: string,
  ): Promise<HorizonAssetRecord | null> {
    try {
      const page = await this.server
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
        `Failed to fetch Horizon asset ${assetCode}:${assetIssuer}: ${error.message}`,
      );
      throw error;
    }
  }

  private async resolveMetadata(
    assetRecord: HorizonAssetRecord,
  ): Promise<ResolvedMetadata> {
    const cacheKey = `nfts:metadata:${this.network}:${assetRecord.asset_issuer}:${assetRecord.asset_code}`;
    const cachedValue = await this.redisService.get(cacheKey);

    if (cachedValue) {
      try {
        return JSON.parse(cachedValue) as ResolvedMetadata;
      } catch (error) {
        this.logger.warn(`Failed to parse cached NFT metadata for ${cacheKey}`);
      }
    }

    const assetContractId = this.getAssetContractId(
      assetRecord.asset_code,
      assetRecord.asset_issuer,
    );
    const { homeDomain, currency } = await this.resolveCurrencyToml(assetRecord);
    const fallbackImageUrl = this.buildFallbackImageUrl(
      assetRecord.asset_code,
      assetRecord.asset_issuer,
    );

    const metadata: ResolvedMetadata = {
      imageUrl:
        typeof currency?.image === 'string' && currency.image.length > 0
          ? currency.image
          : fallbackImageUrl,
      name:
        typeof currency?.name === 'string' && currency.name.length > 0
          ? currency.name
          : assetRecord.asset_code,
      collection: homeDomain || assetRecord.asset_issuer,
      metadata: {
        canonicalAsset: `${assetRecord.asset_code}:${assetRecord.asset_issuer}`,
        asset: this.serializeAssetRecord(assetRecord),
        issuerHomeDomain: homeDomain || null,
        assetContractId,
        currency: currency ?? null,
      },
    };

    await this.redisService.set(
      cacheKey,
      JSON.stringify(metadata),
      this.metadataCacheTtlSeconds,
    );

    return metadata;
  }

  private async resolveCurrencyToml(assetRecord: HorizonAssetRecord): Promise<{
    homeDomain: string | null;
    currency: StellarTomlCurrency | null;
  }> {
    try {
      const issuerAccount = (await this.server.accounts().accountId(
        assetRecord.asset_issuer,
      ).call()) as Record<string, unknown>;
      const homeDomain =
        typeof issuerAccount.home_domain === 'string'
          ? issuerAccount.home_domain
          : null;

      if (!homeDomain) {
        return {
          homeDomain: null,
          currency: null,
        };
      }

      const resolvedToml = await StellarSdk.StellarToml.Resolver.resolve(
        homeDomain,
      );
      const currencies = Array.isArray((resolvedToml as any)?.CURRENCIES)
        ? ((resolvedToml as any).CURRENCIES as StellarTomlCurrency[])
        : [];
      const currency =
        currencies.find(
          (item) =>
            item.code === assetRecord.asset_code &&
            (!item.issuer || item.issuer === assetRecord.asset_issuer),
        ) || null;

      return {
        homeDomain,
        currency,
      };
    } catch (error) {
      this.logger.debug(
        `No stellar.toml metadata found for ${assetRecord.asset_code}:${assetRecord.asset_issuer}`,
      );

      return {
        homeDomain: null,
        currency: null,
      };
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

  private buildUpdatedProfile(
    profile: UserProfile | undefined,
    avatarUrl: string | null,
  ): UserProfile {
    return {
      bio: profile?.bio,
      avatarUrl: avatarUrl ?? profile?.avatarUrl,
      website: profile?.website,
      location: profile?.location,
    };
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

  private getAssetContractId(
    assetCode: string,
    assetIssuer: string,
  ): string | null {
    try {
      const asset = new StellarSdk.Asset(assetCode, assetIssuer) as StellarSdk.Asset & {
        contractId?: (networkPassphrase: string) => string;
      };

      return typeof asset.contractId === 'function'
        ? asset.contractId(this.networkPassphrase)
        : null;
    } catch (error) {
      return null;
    }
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
}
