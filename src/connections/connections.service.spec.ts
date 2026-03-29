import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications/notifications.service';
import { InAppNotificationType } from '../notifications/entities/notification.entity';
import { ConnectionPushNotifier } from './connection-push.notifier';
import { ConnectionsRepository, canonicalPair } from './connections.repository';
import { ConnectionsService, CONNECTION_NOTIFY_SLA_MS } from './connections.service';
import { ConnectionListSortField, ConnectionRequestDirection } from './dto/connection.dto';
import { ConnectionRequest, ConnectionRequestStatus } from './entities/connection-request.entity';
import { ProfessionalConnection } from './entities/professional-connection.entity';

describe('canonicalPair', () => {
  it('orders two UUIDs lexicographically', () => {
    const a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    expect(canonicalPair(b, a)).toEqual([a, b]);
    expect(canonicalPair(a, b)).toEqual([a, b]);
  });
});

describe('ConnectionsService', () => {
  let service: ConnectionsService;
  let repo: jest.Mocked<ConnectionsRepository>;
  let notifications: jest.Mocked<Pick<NotificationsService, 'createNotification'>>;
  let push: jest.Mocked<Pick<ConnectionPushNotifier, 'notifyConnectionRequest'>>;

  const sender = '11111111-1111-1111-1111-111111111111';
  const receiver = '22222222-2222-2222-2222-222222222222';
  const third = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    const repoMock: jest.Mocked<ConnectionsRepository> = {
      userExists: jest.fn(),
      findPendingRequestBetween: jest.fn(),
      findConnectionRequestById: jest.fn(),
      findLatestDeclinedBetween: jest.fn(),
      saveRequest: jest.fn(),
      listRequestsForUser: jest.fn(),
      findProfessionalConnection: jest.fn(),
      saveConnection: jest.fn(),
      deleteProfessionalConnection: jest.fn(),
      findAllConnectionsForUser: jest.fn(),
      countMutualProfessionals: jest.fn(),
      listMutualProfessionalUserIds: jest.fn(),
      refreshMutualCountsForUsers: jest.fn(),
    } as unknown as jest.Mocked<ConnectionsRepository>;

    notifications = { createNotification: jest.fn().mockResolvedValue({} as any) };
    push = { notifyConnectionRequest: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        { provide: ConnectionsRepository, useValue: repoMock },
        { provide: NotificationsService, useValue: notifications },
        { provide: ConnectionPushNotifier, useValue: push },
      ],
    }).compile();

    service = module.get(ConnectionsService);
    repo = module.get(ConnectionsRepository);
  });

  describe('sendRequest', () => {
    it('creates request and notifies in-app + push within SLA window', async () => {
      repo.userExists.mockImplementation(async (id) => id === sender || id === receiver);
      repo.findProfessionalConnection.mockResolvedValue(null);
      repo.findPendingRequestBetween.mockResolvedValue(null);
      repo.findLatestDeclinedBetween.mockResolvedValue(null);

      const saved = Object.assign(new ConnectionRequest(), {
        id: 'req-1',
        senderId: sender,
        receiverId: receiver,
        introMessage: 'Hello',
        status: ConnectionRequestStatus.PENDING,
        createdAt: new Date(),
        respondedAt: null,
      });
      repo.saveRequest.mockResolvedValue(saved);

      const t0 = Date.now();
      const result = await service.sendRequest(sender, {
        receiverId: receiver,
        introMessage: 'Hello',
      });
      const elapsed = Date.now() - t0;

      expect(result.id).toBe('req-1');
      expect(notifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: receiver,
          type: InAppNotificationType.CONNECTION_REQUEST,
        }),
      );
      expect(push.notifyConnectionRequest).toHaveBeenCalledWith(
        receiver,
        expect.objectContaining({ requestId: 'req-1', senderId: sender }),
      );
      expect(elapsed).toBeLessThanOrEqual(CONNECTION_NOTIFY_SLA_MS + 500);
    });

    it('rejects self-request', async () => {
      await expect(
        service.sendRequest(sender, { receiverId: sender, introMessage: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when already connected', async () => {
      repo.userExists.mockResolvedValue(true);
      const [one, two] = canonicalPair(sender, receiver);
      repo.findProfessionalConnection.mockImplementation(async (a, b) =>
        a === one && b === two ? ({} as ProfessionalConnection) : null,
      );

      await expect(
        service.sendRequest(sender, { receiverId: receiver, introMessage: 'Hi' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects on 30-day cooldown after decline', async () => {
      repo.userExists.mockResolvedValue(true);
      repo.findProfessionalConnection.mockResolvedValue(null);
      repo.findPendingRequestBetween.mockResolvedValue(null);
      const recent = Object.assign(new ConnectionRequest(), {
        respondedAt: new Date(),
      });
      repo.findLatestDeclinedBetween.mockResolvedValue(recent);

      await expect(
        service.sendRequest(sender, { receiverId: receiver, introMessage: 'Again' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when receiver missing', async () => {
      repo.userExists.mockImplementation(async (id) => id === sender);

      await expect(
        service.sendRequest(sender, { receiverId: receiver, introMessage: 'Hi' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptRequest', () => {
    it('creates professional connection and refreshes mutual counts', async () => {
      const req = Object.assign(new ConnectionRequest(), {
        id: 'r1',
        senderId: sender,
        receiverId: receiver,
        status: ConnectionRequestStatus.PENDING,
      });
      repo.findConnectionRequestById.mockResolvedValue(req);
      const [one, two] = canonicalPair(sender, receiver);
      const persisted = Object.assign(new ProfessionalConnection(), {
        id: 'c1',
        userOneId: one,
        userTwoId: two,
        connectedAt: new Date(),
        mutualCount: 2,
      });
      repo.findProfessionalConnection
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(persisted);
      repo.countMutualProfessionals.mockResolvedValue(2);
      repo.saveConnection.mockResolvedValue(persisted);
      repo.refreshMutualCountsForUsers.mockResolvedValue(undefined);
      repo.saveRequest.mockImplementation(async (r) => r);

      const out = await service.acceptRequest(receiver, 'r1');
      expect(out.peerUserId).toBe(sender);
      expect(out.mutualCount).toBe(2);
      expect(repo.refreshMutualCountsForUsers).toHaveBeenCalledWith([sender, receiver]);
    });

    it('forbids non-receiver', async () => {
      repo.findConnectionRequestById.mockResolvedValue(
        Object.assign(new ConnectionRequest(), {
          senderId: sender,
          receiverId: receiver,
          status: ConnectionRequestStatus.PENDING,
        }),
      );

      await expect(service.acceptRequest(third, 'r1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('declineRequest', () => {
    it('marks declined with respondedAt', async () => {
      const req = Object.assign(new ConnectionRequest(), {
        id: 'r1',
        senderId: sender,
        receiverId: receiver,
        status: ConnectionRequestStatus.PENDING,
        createdAt: new Date('2024-01-01'),
        introMessage: 'hi',
      });
      repo.findConnectionRequestById.mockResolvedValue(req);
      repo.saveRequest.mockImplementation(async (r) => r);

      const out = await service.declineRequest(receiver, 'r1');
      expect(out.status).toBe(ConnectionRequestStatus.DECLINED);
      expect(req.respondedAt).toBeInstanceOf(Date);
    });
  });

  describe('withdrawRequest', () => {
    it('allows sender only', async () => {
      const req = Object.assign(new ConnectionRequest(), {
        id: 'r1',
        senderId: sender,
        receiverId: receiver,
        status: ConnectionRequestStatus.PENDING,
        createdAt: new Date('2024-01-01'),
        introMessage: 'hi',
      });
      repo.findConnectionRequestById.mockResolvedValue(req);
      repo.saveRequest.mockImplementation(async (r) => r);

      const out = await service.withdrawRequest(sender, 'r1');
      expect(out.status).toBe(ConnectionRequestStatus.WITHDRAWN);
    });
  });

  describe('getConnections', () => {
    it('sorts by mutualCount desc', async () => {
      const [a, b] = canonicalPair(sender, third);
      const [x, y] = canonicalPair(sender, receiver);
      const rows = [
        Object.assign(new ProfessionalConnection(), {
          id: '1',
          userOneId: x,
          userTwoId: y,
          connectedAt: new Date('2020-01-01'),
          mutualCount: 1,
        }),
        Object.assign(new ProfessionalConnection(), {
          id: '2',
          userOneId: a,
          userTwoId: b,
          connectedAt: new Date('2021-01-01'),
          mutualCount: 5,
        }),
      ];
      repo.findAllConnectionsForUser.mockResolvedValue(rows);

      const out = await service.getConnections(sender, {
        sortBy: ConnectionListSortField.MUTUAL_COUNT,
        order: 'desc',
      });
      expect(out[0].mutualCount).toBe(5);
      expect(out[1].mutualCount).toBe(1);
    });
  });

  describe('getConnectionRequests', () => {
    it('defaults to incoming direction', async () => {
      repo.listRequestsForUser.mockResolvedValue([]);
      await service.getConnectionRequests(receiver, {});
      expect(repo.listRequestsForUser).toHaveBeenCalledWith(
        receiver,
        ConnectionRequestDirection.INCOMING,
      );
    });
  });

  describe('getMutualConnections', () => {
    it('returns ids from repository when edge exists', async () => {
      const [one, two] = canonicalPair(sender, receiver);
      repo.findProfessionalConnection.mockResolvedValue(
        Object.assign(new ProfessionalConnection(), { userOneId: one, userTwoId: two }),
      );
      repo.listMutualProfessionalUserIds.mockResolvedValue([third]);

      const ids = await service.getMutualConnections(sender, receiver);
      expect(ids).toEqual([third]);
    });
  });

  describe('removeConnection', () => {
    it('deletes and refreshes mutual counts', async () => {
      const [one, two] = canonicalPair(sender, receiver);
      repo.findProfessionalConnection.mockResolvedValue(
        Object.assign(new ProfessionalConnection(), { userOneId: one, userTwoId: two }),
      );

      await service.removeConnection(sender, receiver);
      expect(repo.deleteProfessionalConnection).toHaveBeenCalledWith(one, two);
      expect(repo.refreshMutualCountsForUsers).toHaveBeenCalledWith([sender, receiver]);
    });
  });
});
