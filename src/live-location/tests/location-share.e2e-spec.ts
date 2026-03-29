import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ChatGateway } from '../../messaging/gateways/chat.gateway';
import { LocationShareController } from '../location-share.controller';
import { LocationShareService } from '../location-share.service';

const conversationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const shareId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const userId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const baseShare = {
  id: shareId,
  userId,
  conversationId,
  latitude: 6.5244,
  longitude: 3.3792,
  accuracy: null,
  duration: 30,
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  isActive: true,
  lastUpdatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

describe('LocationShareController (e2e)', () => {
  let app: INestApplication;
  let service: jest.Mocked<LocationShareService>;
  let gateway: jest.Mocked<ChatGateway>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationShareController],
      providers: [
        {
          provide: LocationShareService,
          useValue: {
            startSharing: jest.fn().mockResolvedValue(baseShare),
            updateLocation: jest.fn().mockResolvedValue({ ...baseShare, latitude: 7.0 }),
            stopSharing: jest.fn().mockResolvedValue(undefined),
            getActiveShares: jest.fn().mockResolvedValue([baseShare]),
          },
        },
        {
          provide: ChatGateway,
          useValue: {
            server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { id: userId };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    service = module.get(LocationShareService);
    gateway = module.get(ChatGateway);
  });

  afterAll(() => app.close());

  describe('POST /api/conversations/:id/location/share', () => {
    it('starts sharing and emits location:update via WebSocket', async () => {
      await request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/location/share`)
        .send({ latitude: 6.5244, longitude: 3.3792, duration: 30 })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBe(shareId);
          expect(res.body.isActive).toBe(true);
        });

      expect(service.startSharing).toHaveBeenCalledWith(userId, conversationId, {
        latitude: 6.5244,
        longitude: 3.3792,
        duration: 30,
      });
      expect(gateway.server.to).toHaveBeenCalledWith(`conversation:${conversationId}`);
    });

    it('rejects invalid latitude', () =>
      request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/location/share`)
        .send({ latitude: 999, longitude: 3.3792 })
        .expect(400));

    it('rejects invalid longitude', () =>
      request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/location/share`)
        .send({ latitude: 6.5244, longitude: 999 })
        .expect(400));

    it('rejects duration > 480', () =>
      request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/location/share`)
        .send({ latitude: 6.5244, longitude: 3.3792, duration: 481 })
        .expect(400));
  });

  describe('PATCH /api/location/shares/:id', () => {
    it('updates location and emits WebSocket event', async () => {
      await request(app.getHttpServer())
        .patch(`/api/location/shares/${shareId}`)
        .send({ latitude: 7.0, longitude: 3.3792 })
        .expect(200)
        .expect((res) => {
          expect(res.body.latitude).toBe(7.0);
        });

      expect(service.updateLocation).toHaveBeenCalledWith(userId, shareId, {
        latitude: 7.0,
        longitude: 3.3792,
      });
      expect(gateway.server.to).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/location/shares/:id', () => {
    it('stops sharing with 204 No Content', async () => {
      await request(app.getHttpServer())
        .delete(`/api/location/shares/${shareId}`)
        .expect(204);

      expect(service.stopSharing).toHaveBeenCalledWith(userId, shareId);
    });
  });

  describe('GET /api/conversations/:id/location/shares', () => {
    it('returns active shares for conversation', async () => {
      await request(app.getHttpServer())
        .get(`/api/conversations/${conversationId}/location/shares`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(1);
          expect(res.body[0].conversationId).toBe(conversationId);
          expect(res.body[0].isActive).toBe(true);
        });

      expect(service.getActiveShares).toHaveBeenCalledWith(userId, conversationId);
    });

    it('supports multiple users sharing simultaneously', async () => {
      const multiShares = [
        { ...baseShare, userId: 'user-a' },
        { ...baseShare, id: 'share-2', userId: 'user-b' },
      ];
      service.getActiveShares.mockResolvedValueOnce(multiShares as any);

      await request(app.getHttpServer())
        .get(`/api/conversations/${conversationId}/location/shares`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(2);
          const userIds = res.body.map((s: any) => s.userId);
          expect(userIds).toContain('user-a');
          expect(userIds).toContain('user-b');
        });
    });
  });
});
