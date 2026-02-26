import { JwtService } from '@nestjs/jwt';
import { AppGateway } from './app.gateway';
import { RedisService } from '../redis/redis.service';

describe('AppGateway', () => {
  let gateway: AppGateway;
  let jwtService: jest.Mocked<JwtService>;
  let redisService: jest.Mocked<RedisService>;

  const createSocket = () =>
    ({
      id: 'socket-1',
      data: {},
      handshake: {
        auth: { token: 'token' },
        headers: {},
      },
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    }) as any;

  beforeEach(() => {
    jest.useFakeTimers();

    jwtService = {
      verify: jest.fn(),
    } as any;

    redisService = {
      hset: jest.fn().mockResolvedValue(undefined),
      hgetall: jest.fn(),
      sadd: jest.fn().mockResolvedValue(undefined),
      srem: jest.fn().mockResolvedValue(undefined),
      smembers: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(undefined),
    } as any;

    gateway = new AppGateway(jwtService, redisService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('disconnects unauthorized clients', async () => {
    const socket = createSocket();
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('stores presence on successful connect', async () => {
    const socket = createSocket();
    jwtService.verify.mockReturnValue({ sub: 'user-1' } as any);

    await gateway.handleConnection(socket);

    expect(redisService.hset).toHaveBeenCalledWith(
      'presence:user-1',
      expect.objectContaining({
        userId: 'user-1',
        socketId: 'socket-1',
      }),
    );
    expect(socket.data.userId).toBe('user-1');
  });

  it('updates redis sets when joining and leaving rooms', async () => {
    const socket = createSocket();
    socket.data.userId = 'user-1';

    await gateway.handleJoinRoom({ room: 'room-1' }, socket);
    await gateway.handleLeaveRoom({ room: 'room-1' }, socket);

    expect(redisService.sadd).toHaveBeenCalledWith(
      'online_users:room-1',
      'user-1',
    );
    expect(redisService.sadd).toHaveBeenCalledWith('user_rooms:user-1', 'room-1');
    expect(redisService.srem).toHaveBeenCalledWith(
      'online_users:room-1',
      'user-1',
    );
    expect(redisService.srem).toHaveBeenCalledWith('user_rooms:user-1', 'room-1');
  });

  it('cleans presence after disconnect grace period', async () => {
    const socket = createSocket();
    socket.data.userId = 'user-1';
    redisService.smembers.mockResolvedValue(['room-1', 'room-2']);

    await gateway.handleDisconnect(socket);
    await jest.advanceTimersByTimeAsync(30000);

    expect(redisService.del).toHaveBeenCalledWith('presence:user-1');
    expect(redisService.smembers).toHaveBeenCalledWith('user_rooms:user-1');
    expect(redisService.srem).toHaveBeenCalledWith('online_users:room-1', 'user-1');
    expect(redisService.srem).toHaveBeenCalledWith('online_users:room-2', 'user-1');
    expect(redisService.del).toHaveBeenCalledWith('user_rooms:user-1');
  });
});
