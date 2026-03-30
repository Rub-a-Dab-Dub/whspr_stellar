import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../src/app-config/app-config.module';
import { AppConfig } from '../src/app-config/entities/app-config.entity';
import { AppConfigValueType } from '../src/app-config/constants';

describe('App Configuration E2E', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [AppConfig],
          synchronize: true,
        }),
        AppConfigModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup auth token - in real implementation, this would involve admin login
    authToken = 'Bearer admin-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/config/public (GET)', () => {
    it('should return only public config values', () => {
      return request(app.getHttpServer())
        .get('/config/public')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('values');
          expect(res.body.values).toHaveProperty('platform.maintenance_mode');
          expect(res.body.values).toHaveProperty('limits.max_attachment_mb');
          expect(res.body.values).toHaveProperty('features.enable_referrals');
          expect(res.body.values).toHaveProperty('platform.support_contact');
          // Should not include private configs
          expect(res.body.values).not.toHaveProperty('limits.daily_transfer_cap_usd');
        });
    });

    it('should return default values when no overrides exist', () => {
      return request(app.getHttpServer())
        .get('/config/public')
        .expect(200)
        .expect((res) => {
          expect(res.body.values.platform.maintenance_mode).toBe(false);
          expect(res.body.values['limits.max_attachment_mb']).toBe(25);
          expect(res.body.values.features.enable_referrals).toBe(true);
        });
    });
  });

  describe('/admin/config (GET)', () => {
    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/admin/config')
        .expect(401);
    });

    it('should return all config entries for authenticated admin', () => {
      return request(app.getHttpServer())
        .get('/admin/config')
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('entries');
          expect(res.body.entries).toHaveProperty('platform.maintenance_mode');
          expect(res.body.entries).toHaveProperty('limits.daily_transfer_cap_usd');
          expect(res.body.entries['platform.maintenance_mode']).toHaveProperty('value');
          expect(res.body.entries['platform.maintenance_mode']).toHaveProperty('valueType');
          expect(res.body.entries['platform.maintenance_mode']).toHaveProperty('isPublic');
          expect(res.body.entries['platform.maintenance_mode']).toHaveProperty('updatedAt');
        });
    });
  });

  describe('/admin/config/:key (PATCH)', () => {
    it('should update a single config key', () => {
      return request(app.getHttpServer())
        .patch('/admin/config/platform.maintenance_mode')
        .set('Authorization', authToken)
        .send({ value: true })
        .expect(200)
        .expect((res) => {
          expect(res.body.value).toBe(true);
          expect(res.body.valueType).toBe(AppConfigValueType.BOOLEAN);
          expect(res.body.updatedBy).toBeDefined();
        });
    });

    it('should validate value types', () => {
      return request(app.getHttpServer())
        .patch('/admin/config/platform.maintenance_mode')
        .set('Authorization', authToken)
        .send({ value: 'not-a-boolean' })
        .expect(400);
    });

    it('should validate value ranges', () => {
      return request(app.getHttpServer())
        .patch('/admin/config/limits.max_attachment_mb')
        .set('Authorization', authToken)
        .send({ value: 1000 }) // Over max limit
        .expect(400);
    });

    it('should reject unknown config keys', () => {
      return request(app.getHttpServer())
        .patch('/admin/config/unknown.key')
        .set('Authorization', authToken)
        .send({ value: true })
        .expect(400);
    });

    it('should handle URL encoded keys', () => {
      return request(app.getHttpServer())
        .patch('/admin/config/platform.support%20contact')
        .set('Authorization', authToken)
        .send({ value: 'new-support@example.com' })
        .expect(200);
    });
  });

  describe('/admin/config/bulk (POST)', () => {
    it('should update multiple config values atomically', () => {
      const bulkPayload = {
        values: {
          'platform.maintenance_mode': true,
          'limits.max_attachment_mb': 50,
          'features.enable_referrals': false,
          'limits.daily_transfer_cap_usd': 20000,
          'platform.support_contact': 'updated-support@example.com',
        },
      };

      return request(app.getHttpServer())
        .post('/admin/config/bulk')
        .set('Authorization', authToken)
        .send(bulkPayload)
        .expect(200)
        .expect((res) => {
          expect(res.body.entries).toHaveProperty('platform.maintenance_mode');
          expect(res.body.entries['platform.maintenance_mode'].value).toBe(true);
          expect(res.body.entries['limits.max_attachment_mb'].value).toBe(50);
          expect(res.body.entries['features.enable_referrals'].value).toBe(false);
        });
    });

    it('should require all registered keys', () => {
      const incompletePayload = {
        values: {
          'platform.maintenance_mode': true,
          // Missing other required keys
        },
      };

      return request(app.getHttpServer())
        .post('/admin/config/bulk')
        .set('Authorization', authToken)
        .send(incompletePayload)
        .expect(400);
    });

    it('should reject unknown keys', () => {
      const invalidPayload = {
        values: {
          'platform.maintenance_mode': true,
          'unknown.key': 'value',
        },
      };

      return request(app.getHttpServer())
        .post('/admin/config/bulk')
        .set('Authorization', authToken)
        .send(invalidPayload)
        .expect(400);
    });
  });

  describe('/admin/config/reset (POST)', () => {
    it('should reset all configs to default values', async () => {
      // First, update some values
      await request(app.getHttpServer())
        .patch('/admin/config/platform.maintenance_mode')
        .set('Authorization', authToken)
        .send({ value: true })
        .expect(200);

      // Then reset
      return request(app.getHttpServer())
        .post('/admin/config/reset')
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          expect(res.body.entries['platform.maintenance_mode'].value).toBe(false);
          expect(res.body.entries['limits.max_attachment_mb'].value).toBe(25);
        });
    });
  });

  describe('/admin/config/:key (DELETE)', () => {
    it('should delete config override', async () => {
      // First, set an override
      await request(app.getHttpServer())
        .patch('/admin/config/platform.maintenance_mode')
        .set('Authorization', authToken)
        .send({ value: true })
        .expect(200);

      // Then delete the override
      return request(app.getHttpServer())
        .delete('/admin/config/platform.maintenance_mode')
        .set('Authorization', authToken)
        .expect(200);
    });

    it('should return 404 for non-existent overrides', () => {
      return request(app.getHttpServer())
        .delete('/admin/config/platform.maintenance_mode')
        .set('Authorization', authToken)
        .expect(404);
    });
  });

  describe('Config propagation', () => {
    it('should reflect changes in public endpoint', async () => {
      // Update a public config
      await request(app.getHttpServer())
        .patch('/admin/config/platform.maintenance_mode')
        .set('Authorization', authToken)
        .send({ value: true })
        .expect(200);

      // Check public endpoint reflects the change
      return request(app.getHttpServer())
        .get('/config/public')
        .expect(200)
        .expect((res) => {
          expect(res.body.values.platform.maintenance_mode).toBe(true);
        });
    });

    it('should not expose private configs in public endpoint', async () => {
      // Update a private config
      await request(app.getHttpServer())
        .patch('/admin/config/limits.daily_transfer_cap_usd')
        .set('Authorization', authToken)
        .send({ value: 50000 })
        .expect(200);

      // Verify it's not in public endpoint
      return request(app.getHttpServer())
        .get('/config/public')
        .expect(200)
        .expect((res) => {
          expect(res.body.values).not.toHaveProperty('limits.daily_transfer_cap_usd');
        });
    });
  });

  describe('Value type validation', () => {
    const testCases = [
      {
        key: 'platform.maintenance_mode',
        validValue: true,
        invalidValues: ['string', 123, {}, []],
      },
      {
        key: 'limits.max_attachment_mb',
        validValue: 25,
        invalidValues: ['string', true, {}, []],
      },
      {
        key: 'platform.support_contact',
        validValue: 'support@example.com',
        invalidValues: [true, 123, {}],
      },
    ];

    testCases.forEach(({ key, validValue, invalidValues }) => {
      it(`should accept valid ${typeof validValue} for ${key}`, () => {
        return request(app.getHttpServer())
          .patch(`/admin/config/${key}`)
          .set('Authorization', authToken)
          .send({ value: validValue })
          .expect(200);
      });

      invalidValues.forEach((invalidValue) => {
        it(`should reject invalid ${typeof invalidValue} for ${key}`, () => {
          return request(app.getHttpServer())
            .patch(`/admin/config/${key}`)
            .set('Authorization', authToken)
            .send({ value: invalidValue })
            .expect(400);
        });
      });
    });
  });

  describe('Business logic validation', () => {
    it('should enforce attachment size limits', () => {
      const testCases = [
        { value: 0, shouldPass: false }, // Below minimum
        { value: 1, shouldPass: true },  // Minimum
        { value: 512, shouldPass: true }, // Maximum
        { value: 513, shouldPass: false }, // Above maximum
      ];

      return Promise.all(
        testCases.map(({ value, shouldPass }) =>
          request(app.getHttpServer())
            .patch('/admin/config/limits.max_attachment_mb')
            .set('Authorization', authToken)
            .send({ value })
            .expect(shouldPass ? 200 : 400)
        )
      );
    });

    it('should enforce transfer cap limits', () => {
      const testCases = [
        { value: -1, shouldPass: false }, // Negative
        { value: 0, shouldPass: true },   // Zero
        { value: 1000000000, shouldPass: true }, // Max
        { value: 1000000001, shouldPass: false }, // Above max
      ];

      return Promise.all(
        testCases.map(({ value, shouldPass }) =>
          request(app.getHttpServer())
            .patch('/admin/config/limits.daily_transfer_cap_usd')
            .set('Authorization', authToken)
            .send({ value })
            .expect(shouldPass ? 200 : 400)
        )
      );
    });

    it('should enforce support contact length limits', () => {
      const longString = 'a'.repeat(257); // Over 256 character limit

      return request(app.getHttpServer())
        .patch('/admin/config/platform.support_contact')
        .set('Authorization', authToken)
        .send({ value: longString })
        .expect(400);
    });
  });
});
