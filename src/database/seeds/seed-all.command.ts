import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

interface RoleSeed {
  name: string;
  description: string;
  permissions: string[];
}

interface FeatureFlagSeed {
  name: string;
  description: string;
  enabled: boolean;
  metadata?: Record<string, any>;
}

interface BadgeDefinitionSeed {
  name: string;
  description: string;
  iconUrl: string;
  criteria: Record<string, any>;
}

interface StickerPackSeed {
  name: string;
  description: string;
  stickerUrls: string[];
  isPremium: boolean;
}

interface TokenWhitelistSeed {
  symbol: string;
  name: string;
  contractAddress: string;
  network: string;
  decimals: number;
}

interface LegalDocumentSeed {
  documentType: string;
  version: string;
  content: string;
  language: string;
}

export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async seedAll(): Promise<void> {
    this.logger.log('Starting database seeding...');

    try {
      await this.seedRoles();
      await this.seedFeatureFlags();
      await this.seedBadgeDefinitions();
      await this.seedStickerPacks();
      await this.seedTokenWhitelist();
      await this.seedLegalDocuments();

      this.logger.log('Database seeding completed successfully!');
    } catch (error) {
      this.logger.error('Seeding failed:', error);
      throw error;
    }
  }

  private async seedRoles(): Promise<void> {
    this.logger.log('Seeding roles...');

    const roles: RoleSeed[] = [
      {
        name: 'admin',
        description: 'System administrator with full access',
        permissions: ['*'],
      },
      {
        name: 'moderator',
        description: 'Moderator with content management permissions',
        permissions: [
          'users:read',
          'users:ban',
          'messages:delete',
          'reports:read',
          'reports:resolve',
          'groups:manage',
        ],
      },
      {
        name: 'user',
        description: 'Standard user with basic permissions',
        permissions: [
          'users:read:self',
          'users:update:self',
          'messages:send',
          'messages:read',
          'groups:join',
          'groups:create',
          'transfers:send',
          'contacts:manage',
        ],
      },
    ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    for (const role of roles) {
      const exists = await queryRunner.query(
        'SELECT 1 FROM "roles" WHERE "name" = $1',
        [role.name],
      );

      if (!exists.length) {
        await queryRunner.query(
          `INSERT INTO "roles" ("name", "description", "permissions", "createdAt", "updatedAt") 
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [role.name, role.description, JSON.stringify(role.permissions)],
        );
        this.logger.log(`  - Seeded role: ${role.name}`);
      } else {
        this.logger.log(`  - Role already exists: ${role.name}`);
      }
    }

    await queryRunner.release();
  }

  private async seedFeatureFlags(): Promise<void> {
    this.logger.log('Seeding feature flags...');

    const featureFlags: FeatureFlagSeed[] = [
      {
        name: 'SEP10_AUTH_ENABLED',
        description: 'Enable SEP-10 Stellar web authentication',
        enabled: true,
      },
      {
        name: 'CONTACT_IMPORT_ENABLED',
        description: 'Enable contact import functionality',
        enabled: true,
      },
      {
        name: 'FRAUD_DETECTION_ENABLED',
        description: 'Enable fraud detection and IP geolocation',
        enabled: true,
      },
      {
        name: 'TWO_FACTOR_AUTH_ENABLED',
        description: 'Enable two-factor authentication',
        enabled: true,
      },
      {
        name: 'GASLESS_TRANSACTIONS_ENABLED',
        description: 'Enable gasless token transfers',
        enabled: true,
      },
      {
        name: 'XP_SYSTEM_ENABLED',
        description: 'Enable XP points and leaderboard system',
        enabled: true,
      },
      {
        name: 'TOKEN_GATED_ROOMS_ENABLED',
        description: 'Enable token-gated chat rooms',
        enabled: true,
      },
      {
        name: 'BOTS_ENABLED',
        description: 'Enable bot integration',
        enabled: true,
      },
      {
        name: 'POLLS_ENABLED',
        description: 'Enable poll creation in conversations',
        enabled: true,
      },
      {
        name: 'VOICE_MESSAGES_ENABLED',
        description: 'Enable voice message sending',
        enabled: true,
      },
    ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    for (const flag of featureFlags) {
      const exists = await queryRunner.query(
        'SELECT 1 FROM "feature_flags" WHERE "name" = $1',
        [flag.name],
      );

      if (!exists.length) {
        await queryRunner.query(
          `INSERT INTO "feature_flags" ("name", "description", "enabled", "metadata", "createdAt", "updatedAt") 
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [flag.name, flag.description, flag.enabled, JSON.stringify(flag.metadata || {})],
        );
        this.logger.log(`  - Seeded feature flag: ${flag.name}`);
      } else {
        this.logger.log(`  - Feature flag already exists: ${flag.name}`);
      }
    }

    await queryRunner.release();
  }

  private async seedBadgeDefinitions(): Promise<void> {
    this.logger.log('Seeding badge definitions...');

    const badges: BadgeDefinitionSeed[] = [
      {
        name: 'Early Adopter',
        description: 'Joined during the beta phase',
        iconUrl: '/badges/early-adopter.svg',
        criteria: { type: 'join_date', before: '2024-01-01' },
      },
      {
        name: 'Verified User',
        description: 'Completed KYC verification',
        iconUrl: '/badges/verified.svg',
        criteria: { type: 'kyc_verified' },
      },
      {
        name: 'Top Contributor',
        description: 'Sent 1000+ messages',
        iconUrl: '/badges/top-contributor.svg',
        criteria: { type: 'message_count', min: 1000 },
      },
      {
        name: 'Community Leader',
        description: 'Created 10+ active groups',
        iconUrl: '/badges/community-leader.svg',
        criteria: { type: 'groups_created', min: 10 },
      },
      {
        name: 'Crypto Enthusiast',
        description: 'Completed 50+ transactions',
        iconUrl: '/badges/crypto-enthusiast.svg',
        criteria: { type: 'transaction_count', min: 50 },
      },
      {
        name: 'Social Butterfly',
        description: 'Added 100+ contacts',
        iconUrl: '/badges/social-butterfly.svg',
        criteria: { type: 'contact_count', min: 100 },
      },
    ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    for (const badge of badges) {
      const exists = await queryRunner.query(
        'SELECT 1 FROM "badge_definitions" WHERE "name" = $1',
        [badge.name],
      );

      if (!exists.length) {
        await queryRunner.query(
          `INSERT INTO "badge_definitions" ("name", "description", "iconUrl", "criteria", "createdAt", "updatedAt") 
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [badge.name, badge.description, badge.iconUrl, JSON.stringify(badge.criteria)],
        );
        this.logger.log(`  - Seeded badge: ${badge.name}`);
      } else {
        this.logger.log(`  - Badge already exists: ${badge.name}`);
      }
    }

    await queryRunner.release();
  }

  private async seedStickerPacks(): Promise<void> {
    this.logger.log('Seeding sticker packs...');

    const stickerPacks: StickerPackSeed[] = [
      {
        name: 'Gasless Gossip Basics',
        description: 'Official Gasless Gossip sticker pack',
        stickerUrls: [
          '/stickers/basic/hello.png',
          '/stickers/basic/thanks.png',
          '/stickers/basic/love.png',
          '/stickers/basic/laugh.png',
          '/stickers/basic/sad.png',
        ],
        isPremium: false,
      },
      {
        name: 'Crypto Emojis',
        description: 'Cryptocurrency-themed stickers',
        stickerUrls: [
          '/stickers/crypto/bitcoin.png',
          '/stickers/crypto/ethereum.png',
          '/stickers/crypto/stellar.png',
          '/stickers/crypto/moon.png',
          '/stickers/crypto/hodl.png',
        ],
        isPremium: false,
      },
      {
        name: 'Premium Reactions',
        description: 'Exclusive premium reaction stickers',
        stickerUrls: [
          '/stickers/premium/fire.png',
          '/stickers/premium/party.png',
          '/stickers/premium/trophy.png',
          '/stickers/premium/diamond.png',
          '/stickers/premium/crown.png',
        ],
        isPremium: true,
      },
    ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    for (const pack of stickerPacks) {
      const exists = await queryRunner.query(
        'SELECT 1 FROM "sticker_packs" WHERE "name" = $1',
        [pack.name],
      );

      if (!exists.length) {
        await queryRunner.query(
          `INSERT INTO "sticker_packs" ("name", "description", "stickerUrls", "isPremium", "createdAt", "updatedAt") 
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [pack.name, pack.description, JSON.stringify(pack.stickerUrls), pack.isPremium],
        );
        this.logger.log(`  - Seeded sticker pack: ${pack.name}`);
      } else {
        this.logger.log(`  - Sticker pack already exists: ${pack.name}`);
      }
    }

    await queryRunner.release();
  }

  private async seedTokenWhitelist(): Promise<void> {
    this.logger.log('Seeding token whitelist...');

    const tokens: TokenWhitelistSeed[] = [
      {
        symbol: 'XLM',
        name: 'Stellar Lumens',
        contractAddress: 'native',
        network: 'stellar-testnet',
        decimals: 7,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        contractAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        network: 'stellar-testnet',
        decimals: 7,
      },
      {
        symbol: 'yXLM',
        name: 'Yield XLM',
        contractAddress: 'GARDNV3Q7YGT4AKSDF25LT32YSCCW4AJ2U2QQJAA4H3XT4GQ6DO3R2WDA',
        network: 'stellar-testnet',
        decimals: 7,
      },
      {
        symbol: 'AQUA',
        name: 'Aquarius',
        contractAddress: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
        network: 'stellar-mainnet',
        decimals: 7,
      },
    ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    for (const token of tokens) {
      const exists = await queryRunner.query(
        'SELECT 1 FROM "tokens" WHERE "symbol" = $1 AND "network" = $2',
        [token.symbol, token.network],
      );

      if (!exists.length) {
        await queryRunner.query(
          `INSERT INTO "tokens" ("symbol", "name", "contractAddress", "network", "decimals", "isActive", "createdAt", "updatedAt") 
           VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
          [token.symbol, token.name, token.contractAddress, token.network, token.decimals],
        );
        this.logger.log(`  - Seeded token: ${token.symbol} (${token.network})`);
      } else {
        this.logger.log(`  - Token already exists: ${token.symbol} (${token.network})`);
      }
    }

    await queryRunner.release();
  }

  private async seedLegalDocuments(): Promise<void> {
    this.logger.log('Seeding legal documents...');

    const documents: LegalDocumentSeed[] = [
      {
        documentType: 'TERMS_OF_SERVICE',
        version: '1.0.0',
        content: `
# Terms of Service

## 1. Acceptance of Terms
By accessing and using Gasless Gossip, you accept and agree to be bound by the terms and provision of this agreement.

## 2. Service Description
Gasless Gossip is a decentralized messaging platform built on the Stellar blockchain, enabling gasless token transfers and secure communication.

## 3. User Responsibilities
Users are responsible for maintaining the security of their Stellar wallets and private keys.

## 4. Prohibited Conduct
Users may not use the service for illegal activities, spam, harassment, or any conduct that violates applicable laws.

## 5. Disclaimer of Warranties
The service is provided "as is" without warranties of any kind, either express or implied.

## 6. Limitation of Liability
We shall not be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of the service.
        `.trim(),
        language: 'en',
      },
      {
        documentType: 'PRIVACY_POLICY',
        version: '1.0.0',
        content: `
# Privacy Policy

## 1. Information Collection
We collect minimal user information necessary for service operation, including Stellar wallet addresses and public profile information.

## 2. Data Usage
User data is used solely for providing and improving our services. We do not sell or share personal information with third parties.

## 3. Data Storage
Contact information is hashed using HMAC-SHA256 before storage. Raw phone numbers and emails are never stored.

## 4. User Rights
Users have the right to access, modify, or delete their personal information at any time.

## 5. Security Measures
We implement industry-standard security measures to protect user data, including encryption and secure hashing.

## 6. Third-Party Services
Our service integrates with Stellar blockchain and may interact with third-party wallets and services.
        `.trim(),
        language: 'en',
      },
      {
        documentType: 'COOKIE_POLICY',
        version: '1.0.0',
        content: `
# Cookie Policy

## 1. Cookie Usage
We use minimal cookies for session management and user preferences.

## 2. Types of Cookies
- Session cookies: Used for authentication state
- Preference cookies: Store user settings
- Analytics cookies: Anonymous usage statistics (opt-in)

## 3. Cookie Control
Users can control cookie preferences through browser settings and application preferences.
        `.trim(),
        language: 'en',
      },
    ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    for (const doc of documents) {
      const exists = await queryRunner.query(
        'SELECT 1 FROM "legal_documents" WHERE "documentType" = $1 AND "version" = $2',
        [doc.documentType, doc.version],
      );

      if (!exists.length) {
        await queryRunner.query(
          `INSERT INTO "legal_documents" ("documentType", "version", "content", "language", "createdAt", "updatedAt") 
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [doc.documentType, doc.version, doc.content, doc.language],
        );
        this.logger.log(`  - Seeded legal document: ${doc.documentType} v${doc.version}`);
      } else {
        this.logger.log(`  - Legal document already exists: ${doc.documentType} v${doc.version}`);
      }
    }

    await queryRunner.release();
  }
}
