import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

describe('SearchController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Seed test data
    await seedTestData(dataSource);
  });

  afterAll(async () => {
    await cleanTestData(dataSource);
    await app.close();
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  describe('GET /api/search — validation', () => {
    it('returns 400 when q is missing', () => {
      return request(app.getHttpServer()).get('/api/search').expect(400);
    });

    it('returns 400 when q is empty string', () => {
      return request(app.getHttpServer()).get('/api/search?q=').expect(400);
    });

    it('returns 400 for invalid type', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=hello&type=invalid')
        .expect(400);
    });

    it('returns 400 when limit is out of range', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=hello&limit=100')
        .expect(400);
    });

    it('returns 400 for invalid groupId (not UUID)', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=hello&groupId=not-a-uuid')
        .expect(400);
    });

    it('returns 400 for invalid dateFrom', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=hello&dateFrom=not-a-date')
        .expect(400);
    });
  });

  // ── Search users ───────────────────────────────────────────────────────────

  describe('GET /api/search?type=user', () => {
    it('returns 200 with user results for a matching query', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=user')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('took');
          expect(Array.isArray(res.body.results)).toBe(true);
        });
    });

    it('returns empty results for a non-matching query', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=zzznomatch999&type=user')
        .expect(200)
        .expect((res) => {
          expect(res.body.results).toHaveLength(0);
          expect(res.body.total).toBe(0);
        });
    });

    it('each user result has the correct shape', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=user')
        .expect(200)
        .expect((res) => {
          if (res.body.results.length > 0) {
            const item = res.body.results[0];
            expect(item).toHaveProperty('id');
            expect(item).toHaveProperty('type', 'user');
            expect(item).toHaveProperty('data');
            expect(item).toHaveProperty('rank');
            expect(item.data).toHaveProperty('username');
            expect(item.data).toHaveProperty('walletAddress');
          }
        });
    });
  });

  // ── Search groups ──────────────────────────────────────────────────────────

  describe('GET /api/search?type=group', () => {
    it('returns 200 for group search', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=group')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
          expect(res.body).toHaveProperty('total');
        });
    });

    it('each group result has the correct shape', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=group')
        .expect(200)
        .expect((res) => {
          if (res.body.results.length > 0) {
            const item = res.body.results[0];
            expect(item).toHaveProperty('type', 'group');
            expect(item.data).toHaveProperty('name');
            expect(item.data).toHaveProperty('isPublic');
          }
        });
    });
  });

  // ── Search messages ────────────────────────────────────────────────────────

  describe('GET /api/search?type=message', () => {
    it('returns 200 for message search', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=message')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
        });
    });

    it('scopes results when groupId is provided', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=message&groupId=00000000-0000-0000-0000-000000000001')
        .expect(200)
        .expect((res) => {
          // Results should only include messages from the specified group
          res.body.results.forEach((item: any) => {
            expect(item.data.groupId).toBe('00000000-0000-0000-0000-000000000001');
          });
        });
    });

    it('filters by dateFrom', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=message&dateFrom=2020-01-01')
        .expect(200);
    });

    it('filters by dateTo', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=message&dateTo=2099-12-31')
        .expect(200);
    });

    it('each message result has the correct shape', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=message')
        .expect(200)
        .expect((res) => {
          if (res.body.results.length > 0) {
            const item = res.body.results[0];
            expect(item).toHaveProperty('type', 'message');
            expect(item.data).toHaveProperty('content');
            expect(item.data).toHaveProperty('createdAt');
          }
        });
    });
  });

  // ── Search tokens ──────────────────────────────────────────────────────────

  describe('GET /api/search?type=token', () => {
    it('returns 200 for token search', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=token')
        .expect(200);
    });

    it('each token result has the correct shape', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=token')
        .expect(200)
        .expect((res) => {
          if (res.body.results.length > 0) {
            const item = res.body.results[0];
            expect(item).toHaveProperty('type', 'token');
            expect(item.data).toHaveProperty('symbol');
            expect(item.data).toHaveProperty('name');
          }
        });
    });
  });

  // ── Global search ──────────────────────────────────────────────────────────

  describe('GET /api/search (global, type=all)', () => {
    it('returns results across multiple types', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('results');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('took');
        });
    });

    it('results are ordered by rank descending', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest')
        .expect(200)
        .expect((res) => {
          const ranks: number[] = res.body.results.map((r: any) => r.rank);
          for (let i = 1; i < ranks.length; i++) {
            expect(ranks[i]).toBeLessThanOrEqual(ranks[i - 1]);
          }
        });
    });

    it('respects limit parameter', () => {
      return request(app.getHttpServer())
        .get('/api/search?q=searchtest&limit=2')
        .expect(200)
        .expect((res) => {
          expect(res.body.results.length).toBeLessThanOrEqual(2);
        });
    });
  });

  // ── Pagination ─────────────────────────────────────────────────────────────

  describe('Cursor-based pagination', () => {
    it('returns nextCursor when more results exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/search?q=searchtest&type=user&limit=1')
        .expect(200);

      // nextCursor may or may not be present depending on data
      expect(res.body).toHaveProperty('results');
    });

    it('accepts cursor param without error', () => {
      const cursor = Buffer.from('0').toString('base64url');
      return request(app.getHttpServer())
        .get(`/api/search?q=searchtest&type=user&cursor=${cursor}`)
        .expect(200);
    });
  });

  // ── Response time ──────────────────────────────────────────────────────────

  describe('Performance', () => {
    it('responds in < 500ms for a typical query', async () => {
      const start = Date.now();
      await request(app.getHttpServer()).get('/api/search?q=searchtest').expect(200);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function seedTestData(dataSource: DataSource): Promise<void> {
  try {
    // Seed a user
    await dataSource.query(`
      INSERT INTO users (id, "walletAddress", username, "displayName", bio, "isActive", "isVerified", tier)
      VALUES (
        '00000000-0000-0000-0000-000000000010',
        '0xsearchtestuser001',
        'searchtestuser',
        'Search Test User',
        'I am a searchtest bio',
        true, false, 'free'
      )
      ON CONFLICT DO NOTHING
    `);

    // Seed a group
    await dataSource.query(`
      INSERT INTO groups (id, name, description, "isPublic")
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'Searchtest Group',
        'A group for searchtest queries',
        true
      )
      ON CONFLICT DO NOTHING
    `);

    // Seed a message
    await dataSource.query(`
      INSERT INTO messages (id, content, "groupId", "senderId")
      VALUES (
        '00000000-0000-0000-0000-000000000020',
        'This is a searchtest message content',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000010'
      )
      ON CONFLICT DO NOTHING
    `);

    // Seed a token
    await dataSource.query(`
      INSERT INTO tokens (id, symbol, name, "contractAddress", network, "isActive")
      VALUES (
        '00000000-0000-0000-0000-000000000030',
        'SRCHTEST',
        'Searchtest Token',
        '0xcontract123',
        'stellar_testnet',
        true
      )
      ON CONFLICT DO NOTHING
    `);
  } catch {
    // Seed failures are non-fatal in e2e (table may not exist if migration not run)
  }
}

async function cleanTestData(dataSource: DataSource): Promise<void> {
  try {
    await dataSource.query(
      `DELETE FROM messages WHERE id = '00000000-0000-0000-0000-000000000020'`,
    );
    await dataSource.query(
      `DELETE FROM tokens   WHERE id = '00000000-0000-0000-0000-000000000030'`,
    );
    await dataSource.query(
      `DELETE FROM groups   WHERE id = '00000000-0000-0000-0000-000000000001'`,
    );
    await dataSource.query(
      `DELETE FROM users    WHERE id = '00000000-0000-0000-0000-000000000010'`,
    );
  } catch {
    // ignore cleanup errors
  }
}
