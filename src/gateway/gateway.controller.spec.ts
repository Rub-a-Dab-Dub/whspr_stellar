import { GatewayController } from './gateway.controller';
import { RedisService } from '../redis/redis.service';

describe('GatewayController', () => {
  it('returns online false when presence does not exist', async () => {
    const redisService = {
      hgetall: jest.fn().mockResolvedValue({}),
    } as unknown as RedisService;

    const controller = new GatewayController(redisService);
    const result = await controller.isUserOnline('user-1');

    expect(result).toEqual({ online: false });
  });

  it('returns online true with presence details', async () => {
    const redisService = {
      hgetall: jest.fn().mockResolvedValue({
        userId: 'user-1',
        socketId: 'socket-1',
      }),
    } as unknown as RedisService;

    const controller = new GatewayController(redisService);
    const result = await controller.isUserOnline('user-1');

    expect(result).toEqual({
      online: true,
      userId: 'user-1',
      socketId: 'socket-1',
    });
  });
});
