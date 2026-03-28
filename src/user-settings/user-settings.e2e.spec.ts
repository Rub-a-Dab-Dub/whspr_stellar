import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { UserSettingsController } from './user-settings.controller';
import { UserSettingsService } from './user-settings.service';

describe('UserSettingsController (e2e)', () => {
  let app: INestApplication;
  const serviceMock = {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    resetSettings: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UserSettingsController],
      providers: [{ provide: UserSettingsService, useValue: serviceMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { id: 'u1' };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /settings', async () => {
    serviceMock.getSettings.mockResolvedValueOnce({ userId: 'u1', theme: 'system' });
    await request(app.getHttpServer()).get('/settings').expect(200);
  });

  it('PATCH /settings', async () => {
    serviceMock.updateSettings.mockResolvedValueOnce({ userId: 'u1', theme: 'dark' });
    await request(app.getHttpServer()).patch('/settings').send({ theme: 'dark' }).expect(200);
  });

  it('POST /settings/reset', async () => {
    serviceMock.resetSettings.mockResolvedValueOnce({ userId: 'u1', theme: 'system' });
    await request(app.getHttpServer()).post('/settings/reset').expect(201);
  });
});
