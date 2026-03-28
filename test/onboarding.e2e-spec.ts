import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingModule } from '../onboarding.module';
import { OnboardingProgress } from '../onboarding/entities/onboarding-progress.entity';
import { OnboardingStep } from '../onboarding/entities/onboarding-progress.entity';

describe('Onboarding E2E', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [OnboardingProgress],
          synchronize: true,
        }),
        OnboardingModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup auth token - in real implementation, this would involve login
    authToken = 'Bearer mock-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/onboarding (GET)', () => {
    it('should return initial onboarding progress for new user', () => {
      return request(app.getHttpServer())
        .get('/onboarding')
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('userId');
          expect(res.body).toHaveProperty('currentStep');
          expect(res.body).toHaveProperty('completedSteps');
          expect(res.body).toHaveProperty('skippedSteps');
          expect(res.body).toHaveProperty('isCompleted', false);
          expect(res.body).toHaveProperty('completionPercentage');
          expect(res.body).toHaveProperty('nextStep');
          expect(Array.isArray(res.body.completedSteps)).toBe(true);
          expect(Array.isArray(res.body.skippedSteps)).toBe(true);
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/onboarding')
        .expect(401);
    });
  });

  describe('/onboarding/steps/:step/complete (POST)', () => {
    it('should complete a valid step', () => {
      return request(app.getHttpServer())
        .post('/onboarding/steps/profile_completed/complete')
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          expect(res.body.completedSteps).toContain('profile_completed');
          expect(res.body.completionPercentage).toBeGreaterThan(0);
        });
    });

    it('should not complete invalid step', () => {
      return request(app.getHttpServer())
        .post('/onboarding/steps/invalid_step/complete')
        .set('Authorization', authToken)
        .expect(400);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .post('/onboarding/steps/profile_completed/complete')
        .expect(401);
    });

    it('should handle duplicate step completion gracefully', async () => {
      // Complete step first time
      await request(app.getHttpServer())
        .post('/onboarding/steps/username_set/complete')
        .set('Authorization', authToken)
        .expect(200);

      // Try to complete same step again
      return request(app.getHttpServer())
        .post('/onboarding/steps/username_set/complete')
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          const usernameSetCount = res.body.completedSteps.filter(
            (step: string) => step === 'username_set'
          ).length;
          expect(usernameSetCount).toBe(1);
        });
    });
  });

  describe('/onboarding/steps/:step/skip (POST)', () => {
    it('should skip a valid step', () => {
      return request(app.getHttpServer())
        .post('/onboarding/steps/first_contact_added/skip')
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          expect(res.body.skippedSteps).toContain('first_contact_added');
        });
    });

    it('should not skip invalid step', () => {
      return request(app.getHttpServer())
        .post('/onboarding/steps/invalid_step/skip')
        .set('Authorization', authToken)
        .expect(400);
    });

    it('should not skip already completed step', async () => {
      // Complete a step first
      await request(app.getHttpServer())
        .post('/onboarding/steps/first_message_sent/complete')
        .set('Authorization', authToken)
        .expect(200);

      // Try to skip the completed step
      return request(app.getHttpServer())
        .post('/onboarding/steps/first_message_sent/skip')
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          expect(res.body.skippedSteps).not.toContain('first_message_sent');
          expect(res.body.completedSteps).toContain('first_message_sent');
        });
    });
  });

  describe('/onboarding/reset (POST)', () => {
    it('should reset onboarding progress', async () => {
      // Complete some steps first
      await request(app.getHttpServer())
        .post('/onboarding/steps/encryption_key_registered/complete')
        .set('Authorization', authToken)
        .expect(200);

      await request(app.getHttpServer())
        .post('/onboarding/steps/first_transfer/complete')
        .set('Authorization', authToken)
        .expect(200);

      // Reset onboarding
      return request(app.getHttpServer())
        .post('/onboarding/reset')
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          expect(res.body.completedSteps).toEqual([]);
          expect(res.body.skippedSteps).toEqual([]);
          expect(res.body.isCompleted).toBe(false);
          expect(res.body.completedAt).toBeNull();
          expect(res.body.currentStep).toBe('wallet_connected');
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .post('/onboarding/reset')
        .expect(401);
    });
  });

  describe('Complete onboarding flow', () => {
    it('should complete full onboarding journey', async () => {
      // Reset first
      await request(app.getHttpServer())
        .post('/onboarding/reset')
        .set('Authorization', authToken)
        .expect(200);

      // Complete all steps in order
      const steps = [
        'wallet_connected',
        'profile_completed',
        'username_set',
        'first_contact_added',
        'first_message_sent',
        'encryption_key_registered',
        'first_transfer',
      ];

      for (const step of steps) {
        await request(app.getHttpServer())
          .post(`/onboarding/steps/${step}/complete`)
          .set('Authorization', authToken)
          .expect(200);
      }

      // Verify onboarding is complete
      return request(app.getHttpServer())
        .get('/onboarding')
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          expect(res.body.isCompleted).toBe(true);
          expect(res.body.completedAt).not.toBeNull();
          expect(res.body.completionPercentage).toBe(100);
          expect(res.body.nextStep).toBeNull();
          expect(res.body.completedSteps).toHaveLength(steps.length);
        });
    });

    it('should handle mixed completion and skipping', async () => {
      // Reset first
      await request(app.getHttpServer())
        .post('/onboarding/reset')
        .set('Authorization', authToken)
        .expect(200);

      // Complete some steps
      await request(app.getHttpServer())
        .post('/onboarding/steps/wallet_connected/complete')
        .set('Authorization', authToken)
        .expect(200);

      await request(app.getHttpServer())
        .post('/onboarding/steps/profile_completed/complete')
        .set('Authorization', authToken)
        .expect(200);

      // Skip some steps
      await request(app.getHttpServer())
        .post('/onboarding/steps/username_set/skip')
        .set('Authorization', authToken)
        .expect(200);

      await request(app.getHttpServer())
        .post('/onboarding/steps/first_contact_added/skip')
        .set('Authorization', authToken)
        .expect(200);

      // Complete remaining steps
      await request(app.getHttpServer())
        .post('/onboarding/steps/first_message_sent/complete')
        .set('Authorization', authToken)
        .expect(200);

      await request(app.getHttpServer())
        .post('/onboarding/steps/encryption_key_registered/complete')
        .set('Authorization', authToken)
        .expect(200);

      await request(app.getHttpServer())
        .post('/onboarding/steps/first_transfer/complete')
        .set('Authorization', authToken)
        .expect(200);

      // Verify onboarding is complete
      return request(app.getHttpServer())
        .get('/onboarding')
        .set('Authorization', authToken)
        .expect(200)
        .expect((res) => {
          expect(res.body.isCompleted).toBe(true);
          expect(res.body.completedAt).not.toBeNull();
          expect(res.body.completionPercentage).toBe(100);
          expect(res.body.completedSteps).toContain('wallet_connected');
          expect(res.body.completedSteps).toContain('profile_completed');
          expect(res.body.skippedSteps).toContain('username_set');
          expect(res.body.skippedSteps).toContain('first_contact_added');
        });
    });
  });

  describe('Step validation', () => {
    it('should validate all step names', () => {
      const validSteps = Object.values(OnboardingStep);
      
      return Promise.all(
        validSteps.map(step =>
          request(app.getHttpServer())
            .post(`/onboarding/steps/${step}/complete`)
            .set('Authorization', authToken)
            .expect(200)
        )
      );
    });

    it('should reject malformed step names', () => {
      const invalidSteps = [
        'invalid-step',
        'WALLET_CONNECTED', // uppercase
        'wallet connected', // space
        'wallet-connected-invalid',
        '',
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
      ];

      return Promise.all(
        invalidSteps.map(step =>
          request(app.getHttpServer())
            .post(`/onboarding/steps/${step}/complete`)
            .set('Authorization', authToken)
            .expect(400)
        )
      );
    });
  });
});
