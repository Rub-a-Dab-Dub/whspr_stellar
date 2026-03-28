import { Injectable, NotFoundException, TooManyRequestsException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { QrCodeService } from '../qr-code/qr-code.service';
import { RedisService } from '../common/redis/redis.service';
import {
  DiscoverUsersQueryDto,
  DiscoveryResultDto,
  PublicProfileCardDto,
} from './dto/username-discovery.dto';

const DISCOVERY_RATE_LIMIT = 30;
const DISCOVERY_RATE_WINDOW_SECONDS = 60;
const PUBLIC_CARD_CACHE_TTL_SECONDS = 60;

type DiscoveryUserRow = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  walletAddress: string;
  tier: string;
  isVerified: boolean;
  reputationScore: string | number | null;
  mutualContactsCount: string | number | null;
  relevanceScore: string | number | null;
};

@Injectable()
export class UsernameDiscoveryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly qrCodeService: QrCodeService,
    private readonly redisService: RedisService,
  ) {}

  async discoverUsers(
    requesterId: string,
    query: DiscoverUsersQueryDto,
  ): Promise<DiscoveryResultDto[]> {
    await this.enforceSearchRateLimit(requesterId);

    const term = query.q.trim();
    const limit = query.limit ?? 15;
    const requesterWallet = await this.getWalletAddressByUserId(requesterId);

    const rows = await this.dataSource.query(
      `
      SELECT
        u.id,
        u.username,
        u."displayName",
        u."avatarUrl",
        u.bio,
        u."walletAddress",
        u.tier,
        u."isVerified",
        COALESCE(rs.score, 0) AS "reputationScore",
        (
          SELECT COUNT(DISTINCT LOWER(sa1."walletAddress"))
          FROM saved_addresses sa1
          INNER JOIN saved_addresses sa2
            ON LOWER(sa1."walletAddress") = LOWER(sa2."walletAddress")
          WHERE sa1."userId" = $4
            AND sa2."userId" = u.id
        ) AS "mutualContactsCount",
        (
          CASE
            WHEN LOWER(u.username) = LOWER($3) THEN 100
            WHEN LOWER(u.username) LIKE LOWER($3 || '%') THEN 80
            WHEN LOWER(COALESCE(u."displayName", '')) LIKE LOWER($3 || '%') THEN 60
            WHEN LOWER(COALESCE(u."displayName", '')) LIKE LOWER($1) THEN 40
            WHEN LOWER(u.username) LIKE LOWER($1) THEN 30
            ELSE 10
          END
        ) AS "relevanceScore"
      FROM users u
      LEFT JOIN reputation_scores rs
        ON rs."userId" = u.id
      LEFT JOIN user_settings us
        ON us."userId" = u.id
      WHERE u."isActive" = true
        AND u.username IS NOT NULL
        AND u.id <> $4
        AND (u.username ILIKE $1 OR COALESCE(u."displayName", '') ILIKE $1)
        AND NOT EXISTS (
          SELECT 1
          FROM discovery_user_blocks b
          WHERE (b."blockerId" = u.id AND b."blockedId" = $4)
             OR (b."blockerId" = $4 AND b."blockedId" = u.id)
        )
        AND LOWER(COALESCE(us."privacySettings"->>'lastSeenVisibility', 'everyone')) <> 'nobody'
        AND (
          LOWER(COALESCE(us."privacySettings"->>'lastSeenVisibility', 'everyone')) NOT IN ('contacts', 'contacts_only')
          OR EXISTS (
            SELECT 1
            FROM saved_addresses sa
            WHERE sa."userId" = u.id
              AND LOWER(sa."walletAddress") = LOWER($2)
          )
        )
      ORDER BY "relevanceScore" DESC, "mutualContactsCount" DESC, COALESCE(rs.score, 0) DESC
      LIMIT $5
      `,
      [`%${term}%`, requesterWallet ?? '', term, requesterId, limit],
    );

    return rows.map((row: DiscoveryUserRow) => this.toDiscoveryResult(row));
  }

  async getByUsername(requesterId: string, username: string): Promise<DiscoveryResultDto> {
    await this.enforceSearchRateLimit(requesterId);
    const row = await this.findVisibleUserRow(requesterId, {
      clause: 'LOWER(u.username) = LOWER($1)',
      value: username.trim(),
    });

    if (!row) {
      throw new NotFoundException('User not found');
    }

    return this.toDiscoveryResult(row);
  }

  async getByWalletAddress(requesterId: string, walletAddress: string): Promise<DiscoveryResultDto> {
    await this.enforceSearchRateLimit(requesterId);
    const row = await this.findVisibleUserRow(requesterId, {
      clause: 'LOWER(u."walletAddress") = LOWER($1)',
      value: walletAddress.trim(),
    });

    if (!row) {
      throw new NotFoundException('User not found');
    }

    return this.toDiscoveryResult(row);
  }

  async getPublicCard(requesterId: string, username: string): Promise<PublicProfileCardDto> {
    const cacheKey = `discovery:card:${requesterId}:${username.trim().toLowerCase()}`;

    return this.cacheService.getOrSet(cacheKey, PUBLIC_CARD_CACHE_TTL_SECONDS, async () => {
      const row = await this.findVisibleUserRow(requesterId, {
        clause: 'LOWER(u.username) = LOWER($1)',
        value: username.trim(),
      });

      if (!row) {
        throw new NotFoundException('User not found');
      }

      return this.toPublicCard(row);
    });
  }

  async getProfileQr(username: string): Promise<Buffer> {
    return this.qrCodeService.generateProfileQR(username.trim());
  }

  private async findVisibleUserRow(
    requesterId: string,
    lookup: { clause: string; value: string },
  ): Promise<DiscoveryUserRow | null> {
    const requesterWallet = await this.getWalletAddressByUserId(requesterId);

    const rows = await this.dataSource.query(
      `
      SELECT
        u.id,
        u.username,
        u."displayName",
        u."avatarUrl",
        u.bio,
        u."walletAddress",
        u.tier,
        u."isVerified",
        COALESCE(rs.score, 0) AS "reputationScore",
        (
          SELECT COUNT(DISTINCT LOWER(sa1."walletAddress"))
          FROM saved_addresses sa1
          INNER JOIN saved_addresses sa2
            ON LOWER(sa1."walletAddress") = LOWER(sa2."walletAddress")
          WHERE sa1."userId" = $2
            AND sa2."userId" = u.id
        ) AS "mutualContactsCount",
        100 AS "relevanceScore"
      FROM users u
      LEFT JOIN reputation_scores rs
        ON rs."userId" = u.id
      LEFT JOIN user_settings us
        ON us."userId" = u.id
      WHERE ${lookup.clause}
        AND u."isActive" = true
        AND u.username IS NOT NULL
        AND u.id <> $2
        AND NOT EXISTS (
          SELECT 1
          FROM discovery_user_blocks b
          WHERE (b."blockerId" = u.id AND b."blockedId" = $2)
             OR (b."blockerId" = $2 AND b."blockedId" = u.id)
        )
        AND LOWER(COALESCE(us."privacySettings"->>'lastSeenVisibility', 'everyone')) <> 'nobody'
        AND (
          LOWER(COALESCE(us."privacySettings"->>'lastSeenVisibility', 'everyone')) NOT IN ('contacts', 'contacts_only')
          OR EXISTS (
            SELECT 1
            FROM saved_addresses sa
            WHERE sa."userId" = u.id
              AND LOWER(sa."walletAddress") = LOWER($3)
          )
        )
      LIMIT 1
      `,
      [lookup.value, requesterId, requesterWallet ?? ''],
    );

    return rows[0] ?? null;
  }

  private async getWalletAddressByUserId(userId: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT "walletAddress" FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return rows[0]?.walletAddress ?? null;
  }

  private async enforceSearchRateLimit(userId: string): Promise<void> {
    const key = `discovery:rate:${userId}`;

    try {
      const client = this.redisService.getClient();
      const next = await client.incr(key);
      if (next === 1) {
        await client.expire(key, DISCOVERY_RATE_WINDOW_SECONDS);
      }

      if (next > DISCOVERY_RATE_LIMIT) {
        throw new TooManyRequestsException('Discovery search rate limit exceeded');
      }
    } catch (error) {
      if (error instanceof TooManyRequestsException) {
        throw error;
      }
      // Degrade gracefully when Redis is unavailable.
    }
  }

  private toDiscoveryResult(row: DiscoveryUserRow): DiscoveryResultDto {
    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      bio: row.bio,
      walletAddressMasked: this.maskWalletAddress(row.walletAddress),
      relevanceScore: Number(row.relevanceScore ?? 0),
      reputationScore: Number(row.reputationScore ?? 0),
      mutualContactsCount: Number(row.mutualContactsCount ?? 0),
    };
  }

  private toPublicCard(row: DiscoveryUserRow): PublicProfileCardDto {
    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      bio: row.bio,
      walletAddressMasked: this.maskWalletAddress(row.walletAddress),
      tier: row.tier,
      isVerified: row.isVerified,
      reputationScore: Number(row.reputationScore ?? 0),
      mutualContactsCount: Number(row.mutualContactsCount ?? 0),
      deepLink: `gasless://profile/${encodeURIComponent(row.username)}`,
    };
  }

  private maskWalletAddress(address: string): string {
    const trimmed = address.trim();
    if (trimmed.length <= 12) {
      return trimmed;
    }
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
  }
}
