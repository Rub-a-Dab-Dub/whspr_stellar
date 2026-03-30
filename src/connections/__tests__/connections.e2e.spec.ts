import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ConnectionsController } from '../connections.controller';
import { ConnectionsService } from '../connections.service';

const mockConnections = {
  sendRequest: jest.fn(),
  acceptRequest: jest.fn(),
  declineRequest: jest.fn(),
  withdrawRequest: jest.fn(),
  removeConnection: jest.fn(),
  getConnections: jest.fn(),
  getConnectionRequests: jest.fn(),
  getMutualConnections: jest.fn(),
  getConnectionCount: jest.fn(),
};

class MockJwtGuard {
  canActivate(ctx: any) {
    const req = ctx.switchToHttp().getRequest();
    req.user = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' };
    return true;
  }
}

describe('Connections (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ConnectionsController],
      providers: [{ provide: ConnectionsService, useValue: mockConnections }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  it('POST /api/connections/request validates intro max length (300)', async () => {
    await request(app.getHttpServer())
      .post('/api/connections/request')
      .send({
        receiverId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
        introMessage: 'x'.repeat(301),
      })
      .expect(400);
  });

  it('POST /api/connections/request returns 201', async () => {
    mockConnections.sendRequest.mockResolvedValue({
      id: 'r1',
      senderId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      receiverId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
      introMessage: 'Hi',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      respondedAt: null,
    });

    await request(app.getHttpServer())
      .post('/api/connections/request')
      .send({
        receiverId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
        introMessage: 'Professional intro',
      })
      .expect(201);
  });

  it('GET /api/connections/requests', async () => {
    mockConnections.getConnectionRequests.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/api/connections/requests').expect(200);
  });

  it('PATCH /api/connections/requests/:id/accept', async () => {
    mockConnections.acceptRequest.mockResolvedValue({
      id: 'c1',
      peerUserId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
      connectedAt: new Date().toISOString(),
      mutualCount: 0,
    });

    const res = await request(app.getHttpServer())
      .patch('/api/connections/requests/c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33/accept')
      .expect(200);

    expect(res.body.peerUserId).toBeDefined();
  });

  it('DELETE /api/connections/:userId returns 204', async () => {
    mockConnections.removeConnection.mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .delete('/api/connections/b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22')
      .expect(204);
  });

  it('GET /api/connections/count', async () => {
    mockConnections.getConnectionCount.mockResolvedValue(3);
    const res = await request(app.getHttpServer()).get('/api/connections/count').expect(200);
    expect(res.body.count).toBe(3);
  });
});
