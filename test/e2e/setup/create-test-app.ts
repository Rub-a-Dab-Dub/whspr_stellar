import './test-env';
import { Inject, Injectable, INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { E2eAppModule } from './e2e-app.module';
import { CryptoService } from '../../../src/auth/services/crypto.service';
import { HorizonService } from '../../../src/wallets/services/horizon.service';
import { SorobanTransfersService } from '../../../src/in-chat-transfers/soroban-transfers.service';
import { User } from '../../../src/users/entities/user.entity';
import { UsersService } from '../../../src/users/users.service';
import { UserSession } from '../../../src/sessions/entities/user-session.entity';
import { UserSettingsService } from '../../../src/user-settings/user-settings.service';
import { Webhook } from '../../../src/webhooks/entities/webhook.entity';
import {
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '../../../src/webhooks/entities/webhook-delivery.entity';
import { WebhooksService } from '../../../src/webhooks/webhooks.service';

@Injectable()
class E2eUsersService {
  constructor(
    @Inject(getRepositoryToken(User))
    private readonly userRepository: Repository<User>,
    private readonly userSettingsService: UserSettingsService,
  ) {}

  async create(dto: Partial<User>): Promise<User> {
    const walletAddress = this.normalizeWallet(dto.walletAddress ?? '');
    const user = this.userRepository.create({
      username: dto.username ?? null,
      walletAddress,
      email: dto.email?.toLowerCase() ?? null,
      displayName: dto.displayName ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      bio: dto.bio ?? null,
      preferredLocale: dto.preferredLocale ?? null,
      referralCode: null,
      isActive: true,
      isVerified: false,
    });
    const saved = await this.userRepository.save(user);
    await this.userSettingsService.ensureSettingsForUser(saved.id);
    return saved;
  }

  async findById(id: string): Promise<User> {
    return this.userRepository.findOneByOrFail({ id });
  }

  async findByUsername(username: string): Promise<User> {
    return this.userRepository.findOneByOrFail({ username });
  }

  async findByWalletAddress(walletAddress: string): Promise<User> {
    return this.userRepository.findOneByOrFail({
      walletAddress: this.normalizeWallet(walletAddress),
    });
  }

  async updateProfile(id: string, dto: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, {
      ...dto,
      email: dto.email?.toLowerCase() ?? user.email,
    });
    return this.userRepository.save(user);
  }

  async deactivate(id: string): Promise<void> {
    const user = await this.findById(id);
    user.isActive = false;
    await this.userRepository.save(user);
  }

  async paginate({ page = 1, limit = 10 }: { page?: number; limit?: number }) {
    const [data, total] = await this.userRepository.findAndCount({
      where: { isActive: true },
      take: limit,
      skip: (page - 1) * limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private normalizeWallet(walletAddress: string): string {
    if (/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return walletAddress.toLowerCase();
    }

    return `0x${createHash('sha1').update(walletAddress).digest('hex').slice(0, 40)}`;
  }
}

@Injectable()
class E2eWebhooksService {
  constructor(
    @Inject(getRepositoryToken(Webhook))
    private readonly webhookRepository: Repository<Webhook>,
    @Inject(getRepositoryToken(WebhookDelivery))
    private readonly deliveryRepository: Repository<WebhookDelivery>,
  ) {}

  async createWebhook(userId: string, dto: any) {
    const entity = this.webhookRepository.create({
      userId,
      url: dto.url,
      events: dto.events,
      secret: dto.secret,
      isActive: dto.isActive ?? true,
      failureCount: 0,
      lastDeliveredAt: null,
    });
    return this.webhookRepository.save(entity);
  }

  async getWebhooks(userId: string) {
    return this.webhookRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async updateWebhook(userId: string, webhookId: string, dto: any) {
    const webhook = await this.webhookRepository.findOneOrFail({
      where: { id: webhookId, userId },
    });
    Object.assign(webhook, dto);
    return this.webhookRepository.save(webhook);
  }

  async deleteWebhook(userId: string, webhookId: string) {
    const webhook = await this.webhookRepository.findOneOrFail({
      where: { id: webhookId, userId },
    });
    await this.webhookRepository.remove(webhook);
  }

  async getDeliveries(userId: string, webhookId: string) {
    await this.webhookRepository.findOneOrFail({ where: { id: webhookId, userId } });
    return this.deliveryRepository.find({ where: { webhookId }, order: { deliveredAt: 'DESC' } });
  }

  async deliverEvent(eventType: string, payload: Record<string, unknown>) {
    const hooks = await this.webhookRepository.find();
    const targets = hooks.filter((hook) => hook.isActive && hook.events.includes(eventType));

    for (const hook of targets) {
      hook.lastDeliveredAt = new Date();
      hook.failureCount = 0;
      await this.webhookRepository.save(hook);

      await this.deliveryRepository.save(
        this.deliveryRepository.create({
          webhookId: hook.id,
          eventType,
          payload,
          status: WebhookDeliveryStatus.SUCCESS,
          responseCode: 200,
        }),
      );
    }
  }
}

export async function createTestApp(): Promise<{
  app: INestApplication;
  dataSource: DataSource;
  jwtService: JwtService;
}> {
  const moduleBuilder = Test.createTestingModule({
    imports: [E2eAppModule],
  })
    .overrideProvider(UsersService)
    .useClass(E2eUsersService)
    .overrideProvider(CryptoService)
    .useValue({
      generateNonce: () => 'a'.repeat(64),
      createSignMessage: (nonce: string) => `Sign this nonce: ${nonce}`,
      verifyStellarSignature: (_walletAddress: string, _message: string, signature: string) =>
        signature === 'test-signature',
      hashToken: async (value: string) => `hash:${value}`,
      compareToken: async (value: string, hash: string) => hash === `hash:${value}`,
    })
    .overrideProvider(HorizonService)
    .useValue({
      isValidAddress: (walletAddress: string) => /^G[A-Z2-7]{55}$/.test(walletAddress),
      buildVerificationMessage: (walletAddress: string, userId: string) =>
        `verify:${walletAddress}:${userId}`,
      getBalances: async () => [
        {
          assetCode: 'XLM',
          assetType: 'native',
          assetIssuer: null,
          balance: '100.0000000',
          buyingLiabilities: '0.0000000',
          sellingLiabilities: '0.0000000',
        },
      ],
    })
    .overrideProvider(SorobanTransfersService)
    .useValue({
      estimateFee: async (_asset: string, _amount: string, recipientCount: number) =>
        (0.0001 * recipientCount).toFixed(7),
      submitTransfer: async () => 'soroban-test-hash',
    })
    .overrideProvider(WebhooksService)
    .useClass(E2eWebhooksService);

  const moduleFixture: TestingModule = await moduleBuilder.compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return {
    app,
    dataSource: moduleFixture.get(DataSource),
    jwtService: moduleFixture.get(JwtService),
  };
}

export async function truncateAllTables(dataSource: DataSource): Promise<void> {
  const tableNames = dataSource.entityMetadatas
    .map((metadata) => `"${metadata.tableName}"`)
    .filter((tableName) => tableName !== '"migrations"');

  if (tableNames.length === 0) {
    return;
  }

  await dataSource.query(`TRUNCATE ${tableNames.join(', ')} RESTART IDENTITY CASCADE;`);
}

export async function authenticateViaChallenge(
  app: INestApplication,
  walletAddress: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: User;
}> {
  await request(app.getHttpServer())
    .post('/api/auth/challenge')
    .send({ walletAddress })
    .expect(200);

  const response = await request(app.getHttpServer())
    .post('/api/auth/verify')
    .send({ walletAddress, signature: 'test-signature' })
    .expect(200);

  return response.body;
}

export async function getUserByWallet(
  dataSource: DataSource,
  walletAddress: string,
): Promise<User | null> {
  if (/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return dataSource
      .getRepository(User)
      .findOne({ where: { walletAddress: walletAddress.toLowerCase() } });
  }

  const normalized = `0x${createHash('sha1').update(walletAddress).digest('hex').slice(0, 40)}`;
  return dataSource.getRepository(User).findOne({ where: { walletAddress: normalized } });
}

export async function listUserSessions(
  dataSource: DataSource,
  userId: string,
): Promise<UserSession[]> {
  return dataSource
    .getRepository(UserSession)
    .find({ where: { userId }, order: { createdAt: 'ASC' } });
}
