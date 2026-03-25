import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { PresenceService } from '../services/presence.service';
import { TypingService } from '../services/typing.service';
import { EventReplayService } from '../services/event-replay.service';
import { MessageType } from '../dto/message-events.dto';

// ─── helpers ────────────────────────────────────────────────────────────────

const USER = { sub: 'user-uuid-1', walletAddress: 'GTEST123' };

const makeClient = (overrides: Record<string, unknown> = {}) => ({
  id: 'socket-id-1',
  data: { user: USER },
  handshake: {
    headers: { authorization: 'Bearer valid-token' },
    auth: {},
    query: {},
  },
  join: jest.fn().mockResolvedValue(undefined),
  leave: jest.fn().mockResolvedValue(undefined),
  emit: jest.fn(),
  to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  disconnect: jest.fn(),
  ...overrides,
});

// ─── suite ──────────────────────────────────────────────────────────────────

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verify'>>;
  let presenceService: jest.Mocked<PresenceService>;
  let typingService: jest.Mocked<TypingService>;
  let eventReplayService: jest.Mocked<EventReplayService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: JwtService,
          useValue: { verify: jest.fn().mockReturnValue(USER) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        {
          provide: PresenceService,
          useValue: {
            setOnline: jest.fn().mockResolvedValue(undefined),
            setOffline: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TypingService,
          useValue: {
            setTyping: jest.fn(),
            clearTyping: jest.fn(),
            clearAllForUser: jest.fn(),
          },
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

    gateway = module.get(ChatGateway);
    jwtService = module.get(JwtService) as unknown as jest.Mocked<Pick<JwtService, 'verify'>>;
    presenceService = module.get(PresenceService) as jest.Mocked<PresenceService>;
    typingService = module.get(TypingService) as jest.Mocked<TypingService>;
    eventReplayService = module.get(EventReplayService) as jest.Mocked<EventReplayService>;

    gateway.server = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as never;
  });

  // ─── handleConnection ──────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('marks user online and broadcasts user:online on valid JWT', async () => {
      const client = makeClient();
      await gateway.handleConnection(client as never);

      expect(presenceService.setOnline).toHaveBeenCalledWith(USER.sub, client.id);
      expect(gateway.server.emit).toHaveBeenCalledWith(
        'user:online',
        expect.objectContaining({ userId: USER.sub }),
      );
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects client when no token is provided', async () => {
      const client = makeClient({
        handshake: { headers: {}, auth: {}, query: {} },
      });
      await gateway.handleConnection(client as never);
      expect(client.disconnect).toHaveBeenCalled();
      expect(presenceService.setOnline).not.toHaveBeenCalled();
    });

    it('disconnects client when JWT verification throws', async () => {
      (jwtService.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('jwt expired');
      });
      const client = makeClient();
      await gateway.handleConnection(client as never);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('stores decoded payload in client.data.user', async () => {
      const client = makeClient({ data: {} });
      await gateway.handleConnection(client as never);
      expect((client as unknown as { data: { user: unknown } }).data.user).toEqual(USER);
    });
  });

  // ─── handleDisconnect ──────────────────────────────────────────────────────

  describe('handleDisconnect', () => {
    it('clears typing indicators, sets offline and broadcasts user:offline', async () => {
      const client = makeClient();
      await gateway.handleDisconnect(client as never);

      expect(typingService.clearAllForUser).toHaveBeenCalledWith(USER.sub);
      expect(presenceService.setOffline).toHaveBeenCalledWith(USER.sub);
      expect(gateway.server.emit).toHaveBeenCalledWith(
        'user:offline',
        expect.objectContaining({ userId: USER.sub }),
      );
    });

    it('is a no-op when client has no user data (connection was rejected)', async () => {
      const client = makeClient({ data: {} });
      await gateway.handleDisconnect(client as never);
      expect(presenceService.setOffline).not.toHaveBeenCalled();
    });
  });

  // ─── room:join ─────────────────────────────────────────────────────────────

  describe('handleJoinRoom', () => {
    it('joins the Socket.io room for the conversation', async () => {
      const client = makeClient();
      await gateway.handleJoinRoom(client as never, {
        conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
      });
      expect(client.join).toHaveBeenCalledWith(
        'conversation:c1c1c1c1-0000-0000-0000-000000000001',
      );
    });

    it('replays missed events when lastEventTimestamp is given', async () => {
      const missed = [
        {
          event: 'message:new',
          data: { content: 'hi' },
          timestamp: 2000,
          roomId: 'conversation:c1c1c1c1-0000-0000-0000-000000000001',
        },
      ];
      (eventReplayService.getMissedEvents as jest.Mock).mockResolvedValueOnce(missed);

      const client = makeClient();
      await gateway.handleJoinRoom(client as never, {
        conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
        lastEventTimestamp: 1000,
      });

      expect(client.emit).toHaveBeenCalledWith('message:new', { content: 'hi' });
    });

    it('does NOT query replay when lastEventTimestamp is absent', async () => {
      const client = makeClient();
      await gateway.handleJoinRoom(client as never, {
        conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
      });
      expect(eventReplayService.getMissedEvents).not.toHaveBeenCalled();
    });
  });

  // ─── room:leave ────────────────────────────────────────────────────────────

  describe('handleLeaveRoom', () => {
    it('leaves the Socket.io room', async () => {
      const client = makeClient();
      await gateway.handleLeaveRoom(client as never, {
        conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
      });
      expect(client.leave).toHaveBeenCalledWith(
        'conversation:c1c1c1c1-0000-0000-0000-000000000001',
      );
    });
  });

  // ─── message:new ──────────────────────────────────────────────────────────

  describe('handleMessageNew', () => {
    const dto = {
      conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
      content: 'Hello world',
    };

    it('stores the event and broadcasts to the room', async () => {
      const roomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: roomEmit });

      const client = makeClient();
      await gateway.handleMessageNew(client as never, dto);

      expect(eventReplayService.storeEvent).toHaveBeenCalledWith(
        'conversation:c1c1c1c1-0000-0000-0000-000000000001',
        'message:new',
        expect.objectContaining({
          content: 'Hello world',
          senderId: USER.sub,
          type: MessageType.TEXT,
        }),
      );
      expect(gateway.server.to).toHaveBeenCalledWith(
        'conversation:c1c1c1c1-0000-0000-0000-000000000001',
      );
      expect(roomEmit).toHaveBeenCalledWith(
        'message:new',
        expect.objectContaining({ content: 'Hello world' }),
      );
    });

    it('includes replyToId when provided', async () => {
      const roomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: roomEmit });

      const client = makeClient();
      await gateway.handleMessageNew(client as never, {
        ...dto,
        replyToId: 'msg-uuid-reply',
      });

      expect(roomEmit).toHaveBeenCalledWith(
        'message:new',
        expect.objectContaining({ replyToId: 'msg-uuid-reply' }),
      );
    });
  });

  // ─── message:edit ─────────────────────────────────────────────────────────

  describe('handleMessageEdit', () => {
    it('stores edit and broadcasts to room', async () => {
      const roomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: roomEmit });

      await gateway.handleMessageEdit(makeClient() as never, {
        messageId: 'msg-1',
        conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
        content: 'Edited',
      });

      expect(roomEmit).toHaveBeenCalledWith(
        'message:edit',
        expect.objectContaining({ messageId: 'msg-1', content: 'Edited' }),
      );
    });
  });

  // ─── message:delete ───────────────────────────────────────────────────────

  describe('handleMessageDelete', () => {
    it('stores deletion and broadcasts to room', async () => {
      const roomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: roomEmit });

      await gateway.handleMessageDelete(makeClient() as never, {
        messageId: 'msg-1',
        conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
      });

      expect(roomEmit).toHaveBeenCalledWith(
        'message:delete',
        expect.objectContaining({ messageId: 'msg-1', deletedBy: USER.sub }),
      );
    });
  });

  // ─── reaction:new ─────────────────────────────────────────────────────────

  describe('handleReactionNew', () => {
    it('stores reaction and broadcasts to room', async () => {
      const roomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: roomEmit });

      await gateway.handleReactionNew(makeClient() as never, {
        messageId: 'msg-1',
        conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
        emoji: '👍',
      });

      expect(roomEmit).toHaveBeenCalledWith(
        'reaction:new',
        expect.objectContaining({ emoji: '👍', userId: USER.sub }),
      );
    });
  });

  // ─── typing:start ─────────────────────────────────────────────────────────

  describe('handleTypingStart', () => {
    it('broadcasts typing:start to other room members', () => {
      const toEmit = jest.fn();
      const client = makeClient({ to: jest.fn().mockReturnValue({ emit: toEmit }) });

      gateway.handleTypingStart(client as never, {
        conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
      });

      expect(client.to).toHaveBeenCalledWith(
        'conversation:c1c1c1c1-0000-0000-0000-000000000001',
      );
      expect(toEmit).toHaveBeenCalledWith(
        'typing:start',
        expect.objectContaining({ userId: USER.sub }),
      );
    });

    it('registers a 3 s auto-stop timer via TypingService', () => {
      const client = makeClient();
      gateway.handleTypingStart(client as never, {
        conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
      });
      expect(typingService.setTyping).toHaveBeenCalledWith(
        USER.sub,
        'c1c1c1c1-0000-0000-0000-000000000001',
        expect.any(Function),
      );
    });

    it('auto-stop callback emits typing:stop to room', () => {
      jest.useFakeTimers();
      const toEmit = jest.fn();
      const client = makeClient({ to: jest.fn().mockReturnValue({ emit: toEmit }) });

      // Use the real TypingService to validate the callback fires
      const realTyping = new (require('../services/typing.service').TypingService)();
      (typingService.setTyping as jest.Mock).mockImplementation(
        (u: string, c: string, cb: () => void) => realTyping.setTyping(u, c, cb),
      );

      gateway.handleTypingStart(client as never, {
        conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
      });

      jest.advanceTimersByTime(3000);
      expect(toEmit).toHaveBeenCalledWith(
        'typing:stop',
        expect.objectContaining({ userId: USER.sub }),
      );
      jest.useRealTimers();
    });
  });

  // ─── typing:stop ──────────────────────────────────────────────────────────

  describe('handleTypingStop', () => {
    it('clears typing indicator and broadcasts typing:stop', () => {
      const toEmit = jest.fn();
      const client = makeClient({ to: jest.fn().mockReturnValue({ emit: toEmit }) });

      gateway.handleTypingStop(client as never, {
        conversationId: 'c1c1c1c1-0000-0000-0000-000000000001',
      });

      expect(typingService.clearTyping).toHaveBeenCalledWith(
        USER.sub,
        'c1c1c1c1-0000-0000-0000-000000000001',
      );
      expect(toEmit).toHaveBeenCalledWith(
        'typing:stop',
        expect.objectContaining({ userId: USER.sub }),
      );
    });
  });
});
