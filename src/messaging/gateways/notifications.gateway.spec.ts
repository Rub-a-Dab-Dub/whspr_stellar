import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';
import { EventReplayService } from '../services/event-replay.service';
import { NotificationDto, NotificationType, TransferUpdateDto } from '../dto/notification-events.dto';

// ─── helpers ────────────────────────────────────────────────────────────────

const USER = { sub: 'user-uuid-1' };

const makeClient = (overrides: Record<string, unknown> = {}) => ({
  id: 'socket-id-1',
  data: { user: USER },
  handshake: {
    headers: { authorization: 'Bearer valid-token' },
    auth: {},
    query: {},
  },
  join: jest.fn().mockResolvedValue(undefined),
  emit: jest.fn(),
  disconnect: jest.fn(),
  ...overrides,
});

// ─── suite ──────────────────────────────────────────────────────────────────

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verify'>>;
  let eventReplayService: jest.Mocked<EventReplayService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        {
          provide: JwtService,
          useValue: { verify: jest.fn().mockReturnValue(USER) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        {
          provide: EventReplayService,
          useValue: {
            storeEvent: jest.fn().mockResolvedValue(undefined),
            getMissedEvents: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    gateway = module.get(NotificationsGateway);
    jwtService = module.get(JwtService) as unknown as jest.Mocked<Pick<JwtService, 'verify'>>;
    eventReplayService = module.get(EventReplayService) as jest.Mocked<EventReplayService>;

    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as never;
  });

  // ─── handleConnection ─────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('authenticates, joins personal notification room', async () => {
      const client = makeClient();
      await gateway.handleConnection(client as never);
      expect(client.join).toHaveBeenCalledWith(`notifications:${USER.sub}`);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('attaches decoded payload to client.data.user', async () => {
      const client = makeClient({ data: {} });
      await gateway.handleConnection(client as never);
      expect((client as unknown as { data: { user: unknown } }).data.user).toEqual(USER);
    });

    it('disconnects when no token is present', async () => {
      const client = makeClient({ handshake: { headers: {}, auth: {}, query: {} } });
      await gateway.handleConnection(client as never);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects when JWT verification fails', async () => {
      (jwtService.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('jwt expired');
      });
      const client = makeClient();
      await gateway.handleConnection(client as never);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('accepts token from handshake.auth', async () => {
      const client = makeClient({
        handshake: { headers: {}, auth: { token: 'valid' }, query: {} },
      });
      await gateway.handleConnection(client as never);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('accepts token from query string', async () => {
      const client = makeClient({
        handshake: { headers: {}, auth: {}, query: { token: 'valid' } },
      });
      await gateway.handleConnection(client as never);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('replays missed events when lastEventTimestamp is provided in query', async () => {
      const missed = [
        {
          event: 'notification:new',
          data: { title: 'Hi' },
          timestamp: 2000,
          roomId: `notifications:${USER.sub}`,
        },
      ];
      (eventReplayService.getMissedEvents as jest.Mock).mockResolvedValueOnce(missed);

      const client = makeClient({
        handshake: {
          headers: { authorization: 'Bearer valid-token' },
          auth: {},
          query: { lastEventTimestamp: '1000' },
        },
      });
      await gateway.handleConnection(client as never);

      expect(eventReplayService.getMissedEvents).toHaveBeenCalledWith(
        `notifications:${USER.sub}`,
        1000,
      );
      expect(client.emit).toHaveBeenCalledWith('notification:new', { title: 'Hi' });
    });

    it('does NOT query replay when lastEventTimestamp is absent', async () => {
      const client = makeClient();
      await gateway.handleConnection(client as never);
      expect(eventReplayService.getMissedEvents).not.toHaveBeenCalled();
    });

    it('does NOT query replay when lastEventTimestamp is not a number', async () => {
      const client = makeClient({
        handshake: {
          headers: { authorization: 'Bearer valid-token' },
          auth: {},
          query: { lastEventTimestamp: 'not-a-number' },
        },
      });
      await gateway.handleConnection(client as never);
      expect(eventReplayService.getMissedEvents).not.toHaveBeenCalled();
    });
  });

  // ─── handleDisconnect ─────────────────────────────────────────────────────

  describe('handleDisconnect', () => {
    it('completes without error for authenticated client', async () => {
      await expect(
        gateway.handleDisconnect(makeClient() as never),
      ).resolves.toBeUndefined();
    });

    it('is a no-op when client has no user data', async () => {
      await expect(
        gateway.handleDisconnect(makeClient({ data: {} }) as never),
      ).resolves.toBeUndefined();
    });
  });

  // ─── sendNotification ─────────────────────────────────────────────────────

  describe('sendNotification', () => {
    const notification: NotificationDto = {
      id: 'notif-1',
      type: NotificationType.MESSAGE,
      title: 'New message',
      body: 'You have a new message',
    };

    it('stores event and emits notification:new to user room', async () => {
      const roomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: roomEmit });

      await gateway.sendNotification(USER.sub, notification);

      expect(eventReplayService.storeEvent).toHaveBeenCalledWith(
        `notifications:${USER.sub}`,
        'notification:new',
        expect.objectContaining({ title: 'New message', id: 'notif-1' }),
      );
      expect(gateway.server.to).toHaveBeenCalledWith(`notifications:${USER.sub}`);
      expect(roomEmit).toHaveBeenCalledWith(
        'notification:new',
        expect.objectContaining({ title: 'New message' }),
      );
    });

    it('includes a timestamp in the emitted payload', async () => {
      const roomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: roomEmit });

      await gateway.sendNotification(USER.sub, notification);

      const [, payload] = roomEmit.mock.calls[0] as [string, { timestamp: number }];
      expect(typeof payload.timestamp).toBe('number');
    });
  });

  // ─── sendTransferUpdate ───────────────────────────────────────────────────

  describe('sendTransferUpdate', () => {
    const transfer: TransferUpdateDto = {
      transferId: 'tx-1',
      status: 'completed',
      amount: '100',
      currency: 'XLM',
      txHash: '0xabc',
    };

    it('stores event and emits transfer:update to user room', async () => {
      const roomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: roomEmit });

      await gateway.sendTransferUpdate(USER.sub, transfer);

      expect(eventReplayService.storeEvent).toHaveBeenCalledWith(
        `notifications:${USER.sub}`,
        'transfer:update',
        expect.objectContaining({ transferId: 'tx-1', status: 'completed' }),
      );
      expect(gateway.server.to).toHaveBeenCalledWith(`notifications:${USER.sub}`);
      expect(roomEmit).toHaveBeenCalledWith(
        'transfer:update',
        expect.objectContaining({ transferId: 'tx-1' }),
      );
    });

    it('includes optional fields when provided', async () => {
      const roomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: roomEmit });

      await gateway.sendTransferUpdate(USER.sub, transfer);
      const [, payload] = roomEmit.mock.calls[0] as [string, TransferUpdateDto];
      expect(payload.txHash).toBe('0xabc');
      expect(payload.currency).toBe('XLM');
    });
  });
});
