import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import {
  ADMIN_STREAM_EVENTS,
  AdminEventStreamGateway,
} from './admin-event-stream.gateway';

describe('AdminEventStreamGateway', () => {
  let gateway: AdminEventStreamGateway;
  const jwtService = {
    verify: jest.fn(),
  } as unknown as JwtService;
  const configService = {
    get: jest.fn().mockReturnValue('jwt-secret'),
  } as unknown as ConfigService;
  const userRepository = {
    findOne: jest.fn(),
  } as unknown as Repository<User>;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new AdminEventStreamGateway(
      jwtService,
      configService,
      userRepository,
    );
    (gateway as any).server = { sockets: { sockets: new Map() } };
  });

  it('disconnects connection without token', async () => {
    const client = {
      id: 'socket-1',
      handshake: { query: {}, auth: {} },
      disconnect: jest.fn(),
      data: {},
    } as any;

    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('disconnects non-admin users', async () => {
    const client = {
      id: 'socket-2',
      handshake: { query: { token: 'token' }, auth: {} },
      disconnect: jest.fn(),
      data: {},
    } as any;
    (jwtService.verify as jest.Mock).mockReturnValue({ sub: 'user-1' });
    (userRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'user-1',
      roles: [{ name: 'user' }],
    });

    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('accepts admin users and stores socket id', async () => {
    const client = {
      id: 'socket-3',
      handshake: { query: { token: 'token' }, auth: {} },
      disconnect: jest.fn(),
      data: {},
    } as any;
    (jwtService.verify as jest.Mock).mockReturnValue({ sub: 'admin-1' });
    (userRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      roles: [{ name: 'admin' }],
    });

    await gateway.handleConnection(client);

    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.data.adminId).toBe('admin-1');
    expect((gateway as any).adminSockets.has('socket-3')).toBe(true);
  });

  it('broadcasts events to connected admin sockets', () => {
    const emit = jest.fn();
    (gateway as any).adminSockets.add('socket-3');
    (gateway as any).server.sockets.sockets.set('socket-3', {
      connected: true,
      emit,
    });

    gateway.onPlatformError({
      type: 'platform.error',
      timestamp: new Date().toISOString(),
      entity: { message: 'boom' },
    });

    expect(emit).toHaveBeenCalledWith(
      'event',
      expect.objectContaining({ type: 'platform.error' }),
    );
  });

  it('routes stream event handlers through broadcast', () => {
    const spy = jest.spyOn(gateway as any, 'broadcast');
    const payload = {
      type: 'user.banned' as const,
      timestamp: new Date().toISOString(),
      entity: { userId: 'u1' },
    };

    gateway.onUserBanned(payload);
    gateway.onUserRegistered({ ...payload, type: 'user.registered' });
    gateway.onTransactionLarge({ ...payload, type: 'transaction.large' });
    gateway.onRoomFlagged({ ...payload, type: 'room.flagged' });
    gateway.onPlatformError({ ...payload, type: 'platform.error' });

    expect(spy).toHaveBeenCalledTimes(5);
    expect(ADMIN_STREAM_EVENTS.USER_BANNED).toBe('admin.stream.user.banned');
  });
});
