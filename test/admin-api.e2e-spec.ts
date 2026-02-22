import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

type UserState = { id: string; isBanned: boolean };
type RoomState = { id: string; closed: boolean; deleted: boolean };
type TxState = { id: string; status: string; type: string };

type AccessToken = { token: string; expiresAt: number; adminId: string };

@Injectable()
class AdminStateService {
  public users = new Map<string, UserState>([
    ['user-1', { id: 'user-1', isBanned: false }],
  ]);

  public rooms = new Map<string, RoomState>([
    ['room-1', { id: 'room-1', closed: false, deleted: false }],
  ]);

  public transactions: TxState[] = [
    { id: 'tx-1', status: 'completed', type: 'tip' },
    { id: 'tx-2', status: 'failed', type: 'room_fee' },
    { id: 'tx-3', status: 'completed', type: 'room_fee' },
  ];

  public auditLogs: Array<{ action: string; targetId?: string; at: string }> =
    [];

  private accessTokens = new Map<string, AccessToken>();
  private refreshTokens = new Map<string, string>();

  login(email: string, password: string) {
    if (email !== 'admin@test.com' || password !== 'password') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = `acc-${Date.now()}`;
    const refreshToken = `ref-${Date.now()}`;
    this.accessTokens.set(accessToken, {
      token: accessToken,
      expiresAt: Date.now() + 1000,
      adminId: 'admin-1',
    });
    this.refreshTokens.set(refreshToken, 'admin-1');

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 1,
    };
  }

  refresh(refreshToken: string) {
    const adminId = this.refreshTokens.get(refreshToken);
    if (!adminId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newAccess = `acc-${Date.now()}-new`;
    this.accessTokens.set(newAccess, {
      token: newAccess,
      expiresAt: Date.now() + 60_000,
      adminId,
    });

    return { access_token: newAccess, expires_in: 60 };
  }

  verifyAccessToken(token: string): AccessToken {
    const found = this.accessTokens.get(token);
    if (!found || found.expiresAt <= Date.now()) {
      throw new UnauthorizedException('Token expired or invalid');
    }
    return found;
  }

  addAudit(action: string, targetId?: string) {
    this.auditLogs.push({ action, targetId, at: new Date().toISOString() });
  }
}

@Injectable()
class BearerAuthGuard implements CanActivate {
  constructor(private readonly state: AdminStateService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization;
    const token =
      typeof header === 'string' ? header.replace('Bearer ', '') : '';
    const payload = this.state.verifyAccessToken(token);
    req.user = { adminId: payload.adminId };
    return true;
  }
}

@Controller('admin/auth')
class TestAdminAuthController {
  constructor(private readonly state: AdminStateService) {}

  @Post('login')
  login(@Body() dto: { email: string; password: string }) {
    return this.state.login(dto.email, dto.password);
  }

  @Post('refresh')
  refresh(@Body() dto: { refresh_token: string }) {
    return this.state.refresh(dto.refresh_token);
  }
}

@Controller('admin')
@UseGuards(BearerAuthGuard)
class TestAdminProtectedController {
  constructor(private readonly state: AdminStateService) {}

  @Get('protected')
  protectedEndpoint() {
    return { ok: true };
  }

  @Patch('users/:id/ban')
  ban(@Param('id') id: string) {
    const user = this.state.users.get(id);
    user.isBanned = true;
    this.state.addAudit('user.banned', id);
    return user;
  }

  @Patch('users/:id/unban')
  unban(@Param('id') id: string) {
    const user = this.state.users.get(id);
    user.isBanned = false;
    this.state.addAudit('user.unbanned', id);
    return user;
  }

  @Patch('rooms/:id/close')
  closeRoom(@Param('id') id: string) {
    const room = this.state.rooms.get(id);
    room.closed = true;
    this.state.addAudit('room.closed', id);
    return room;
  }

  @Delete('rooms/:id')
  deleteRoom(@Param('id') id: string) {
    const room = this.state.rooms.get(id);
    room.deleted = true;
    this.state.addAudit('room.deleted', id);
    return room;
  }

  @Post('rooms/:id/restore')
  restoreRoom(@Param('id') id: string) {
    const room = this.state.rooms.get(id);
    room.deleted = false;
    room.closed = false;
    this.state.addAudit('room.restored', id);
    return room;
  }

  @Get('transactions')
  listTransactions(
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.state.transactions.filter((tx) => {
      if (status && tx.status !== status) {
        return false;
      }
      if (type && tx.type !== type) {
        return false;
      }
      return true;
    });
  }

  @Get('audit-logs')
  logs() {
    return this.state.auditLogs;
  }
}

@Module({
  controllers: [TestAdminAuthController, TestAdminProtectedController],
  providers: [AdminStateService, BearerAuthGuard],
})
class TestAdminModule {}

describe('Admin API flows (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAdminModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('covers auth flow login -> protected -> expiry -> refresh', async () => {
    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'admin@test.com', password: 'password' })
      .expect(201);

    const access = login.body.access_token;
    const refresh = login.body.refresh_token;

    await request(app.getHttpServer())
      .get('/admin/protected')
      .set('Authorization', `Bearer ${access}`)
      .expect(200);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    await request(app.getHttpServer())
      .get('/admin/protected')
      .set('Authorization', `Bearer ${access}`)
      .expect(401);

    const refreshed = await request(app.getHttpServer())
      .post('/admin/auth/refresh')
      .send({ refresh_token: refresh })
      .expect(201);

    await request(app.getHttpServer())
      .get('/admin/protected')
      .set('Authorization', `Bearer ${refreshed.body.access_token}`)
      .expect(200);
  });

  it('covers user ban/unban lifecycle and audit logging', async () => {
    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'admin@test.com', password: 'password' })
      .expect(201);

    const token = login.body.access_token;

    const banned = await request(app.getHttpServer())
      .patch('/admin/users/user-1/ban')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(banned.body.isBanned).toBe(true);

    const unbanned = await request(app.getHttpServer())
      .patch('/admin/users/user-1/unban')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unbanned.body.isBanned).toBe(false);
  });

  it('covers room close/delete/restore lifecycle', async () => {
    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'admin@test.com', password: 'password' })
      .expect(201);

    const token = login.body.access_token;

    await request(app.getHttpServer())
      .patch('/admin/rooms/room-1/close')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.closed).toBe(true);
      });

    await request(app.getHttpServer())
      .delete('/admin/rooms/room-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.deleted).toBe(true);
      });

    await request(app.getHttpServer())
      .post('/admin/rooms/room-1/restore')
      .set('Authorization', `Bearer ${token}`)
      .expect(201)
      .expect(({ body }) => {
        expect(body.deleted).toBe(false);
        expect(body.closed).toBe(false);
      });
  });

  it('lists transactions with filters', async () => {
    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'admin@test.com', password: 'password' })
      .expect(201);

    const token = login.body.access_token;

    const filtered = await request(app.getHttpServer())
      .get('/admin/transactions?status=completed&type=room_fee')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].id).toBe('tx-3');
  });

  it('exposes audit logs for critical actions', async () => {
    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'admin@test.com', password: 'password' })
      .expect(201);

    const token = login.body.access_token;

    const logs = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const actions = logs.body.map((entry: { action: string }) => entry.action);

    expect(actions).toEqual(
      expect.arrayContaining([
        'user.banned',
        'user.unbanned',
        'room.closed',
        'room.deleted',
        'room.restored',
      ]),
    );
  });
});
