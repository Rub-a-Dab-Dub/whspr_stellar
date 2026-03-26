import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsJwtGuard } from './ws-jwt.guard';

const makeContext = (client: Record<string, unknown>): ExecutionContext =>
  ({
    switchToWs: () => ({ getClient: () => client }),
  }) as unknown as ExecutionContext;

describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;
  let jwtService: jest.Mocked<JwtService>;

  const validPayload = { sub: 'user-1', walletAddress: 'GTEST123' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsJwtGuard,
        {
          provide: JwtService,
          useValue: { verify: jest.fn().mockReturnValue(validPayload) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    guard = module.get(WsJwtGuard);
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
  });

  it('authenticates with a valid Bearer token in Authorization header', async () => {
    const client = {
      data: {},
      handshake: { headers: { authorization: 'Bearer valid-token' }, auth: {}, query: {} },
    };
    const result = await guard.canActivate(makeContext(client));
    expect(result).toBe(true);
    expect(client.data.user).toEqual(validPayload);
  });

  it('authenticates with token in handshake.auth', async () => {
    const client = {
      data: {},
      handshake: { headers: {}, auth: { token: 'valid-token' }, query: {} },
    };
    const result = await guard.canActivate(makeContext(client));
    expect(result).toBe(true);
  });

  it('authenticates with token in handshake.query', async () => {
    const client = {
      data: {},
      handshake: { headers: {}, auth: {}, query: { token: 'valid-token' } },
    };
    const result = await guard.canActivate(makeContext(client));
    expect(result).toBe(true);
  });

  it('throws WsException when no token is provided', async () => {
    const client = {
      data: {},
      handshake: { headers: {}, auth: {}, query: {} },
    };
    await expect(guard.canActivate(makeContext(client))).rejects.toThrow(WsException);
  });

  it('throws WsException when Bearer type is wrong', async () => {
    const client = {
      data: {},
      handshake: { headers: { authorization: 'Basic invalid' }, auth: {}, query: {} },
    };
    await expect(guard.canActivate(makeContext(client))).rejects.toThrow(WsException);
  });

  it('throws WsException when JWT verification fails', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const client = {
      data: {},
      handshake: { headers: { authorization: 'Bearer expired-token' }, auth: {}, query: {} },
    };
    await expect(guard.canActivate(makeContext(client))).rejects.toThrow(WsException);
  });
});
