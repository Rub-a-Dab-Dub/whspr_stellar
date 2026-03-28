import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { User, UserTier } from '../src/users/entities/user.entity';
import { SavedAddress } from '../src/address-book/entities/saved-address.entity';

describe('AddressBookController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let userId: string;
  let token: string;

  const walletA = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const walletB = 'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

  beforeAll(async () => {
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'test_jwt_secret_minimum_32_characters_long';

    const { AppModule } = await import('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    jwtService = moduleFixture.get(JwtService);

    const users = dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        walletAddress: 'GZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
        tier: UserTier.FREE,
        isActive: true,
      }),
    );

    userId = user.id;
    token = jwtService.sign({ sub: user.id, walletAddress: user.walletAddress });
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.getRepository(SavedAddress).delete({});
      await dataSource.getRepository(User).delete({});
    }
    if (app) {
      await app.close();
    }
  });

  it('POST /address-book creates entry with valid stellar address', async () => {
    await request(app.getHttpServer())
      .post('/api/address-book')
      .set('Authorization', `Bearer ${token}`)
      .send({ walletAddress: walletA, alias: 'Mom', tags: ['family'] })
      .expect(201)
      .expect((res) => {
        expect(res.body.alias).toBe('Mom');
        expect(res.body.walletAddress).toBe(walletA);
      });
  });

  it('POST /address-book rejects invalid stellar address', async () => {
    await request(app.getHttpServer())
      .post('/api/address-book')
      .set('Authorization', `Bearer ${token}`)
      .send({ walletAddress: 'bad', alias: 'Invalid' })
      .expect(400);
  });

  it('GET /address-book/search finds by alias/address/tag', async () => {
    await request(app.getHttpServer())
      .post('/api/address-book')
      .set('Authorization', `Bearer ${token}`)
      .send({ walletAddress: walletB, alias: 'Vendor', tags: ['merchant'] })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/address-book/search?q=ven')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((v: any) => v.alias === 'Vendor')).toBe(true);
      });

    await request(app.getHttpServer())
      .get('/api/address-book/search?tag=merchant')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.some((v: any) => v.alias === 'Vendor')).toBe(true);
      });
  });

  it('GET /address-book/search?suggest=true returns autocomplete list', async () => {
    await request(app.getHttpServer())
      .get('/api/address-book/search?suggest=true&q=g')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('PATCH + DELETE /address-book/:id updates then removes entry', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/address-book')
      .set('Authorization', `Bearer ${token}`)
      .send({
        walletAddress: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        alias: 'Temp',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/address-book/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ alias: 'Updated Temp', tags: ['updated'] })
      .expect(200)
      .expect((res) => {
        expect(res.body.alias).toBe('Updated Temp');
      });

    await request(app.getHttpServer())
      .delete(`/api/address-book/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });
});
