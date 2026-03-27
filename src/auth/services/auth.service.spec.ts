import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import { UsersService } from '../../users/users.service';
import { SessionsService } from '../../sessions/sessions.service';
import { AuthChallenge } from '../entities/auth-challenge.entity';
import { AuthAttempt } from '../entities/auth-attempt.entity';
import { UserTier } from '../../users/entities/user.entity';
import { TranslationService } from '../../i18n/services/translation.service';

describe('AuthService', () => {
  let service: AuthService;
  let cryptoService: jest.Mocked<CryptoService>;
  let usersService: jest.Mocked<UsersService>;
  let sessionsService: jest.Mocked<SessionsService>;
  let jwtService: jest.Mocked<JwtService>;

  const WALLET = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';
  const IP = '127.0.0.1';
  const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0';
  const NONCE = 'abc123';
  const MESSAGE = `Sign this message to authenticate with Gasless Gossip:\n\nNonce: ${NONCE}\n\nThis request will not trigger a blockchain transaction or cost any fees.`;

  const mockUser = {
    id: 'user-uuid',
    walletAddress: WALLET,
    username: null,
    email: null,
    displayName: null,
    avatarUrl: null,
    bio: null,
    preferredLocale: null,
    tier: UserTier.FREE,
    isActive: true,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockChallenge: AuthChallenge = {
    id: 'challenge-uuid',
    walletAddress: WALLET,
    nonce: NONCE,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    createdAt: new Date(),
  };

  const mockSession = {
    id: 'session-uuid',
    userId: mockUser.id,
    refreshTokenHash: 'hashed-token',
    deviceInfo: 'Chrome on macOS',
    ipAddress: IP,
    userAgent: USER_AGENT,
    lastActiveAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    revokedAt: null,
  };

  const mockChallengeRepo = {
    delete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAttemptRepo = {
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: CryptoService,
          useValue: {
            generateNonce: jest.fn().mockReturnValue(NONCE),
            createSignMessage: jest.fn().mockReturnValue(MESSAGE),
            verifyStellarSignature: jest.fn(),
            hashToken: jest.fn().mockResolvedValue('hashed-token'),
            compareToken: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByWalletAddress: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: SessionsService,
          useValue: {
            createSession: jest.fn().mockResolvedValue(mockSession),
            rotateSession: jest.fn().mockResolvedValue(mockSession),
            revokeSession: jest.fn().mockResolvedValue(undefined),
            touchSession: jest.fn().mockResolvedValue(undefined),
            validateActiveSession: jest.fn().mockResolvedValue(undefined),
            validateRefreshSession: jest.fn().mockResolvedValue(mockSession),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        {
          provide: TranslationService,
          useValue: {
            translate: jest.fn((key: string) => key),
          },
        },
        { provide: getRepositoryToken(AuthChallenge), useValue: mockChallengeRepo },
        { provide: getRepositoryToken(AuthAttempt), useValue: mockAttemptRepo },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    cryptoService = module.get(CryptoService);
    usersService = module.get(UsersService);
    sessionsService = module.get(SessionsService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
    mockAttemptRepo.count.mockResolvedValue(0);
    mockChallengeRepo.create.mockReturnValue(mockChallenge);
    mockAttemptRepo.create.mockReturnValue({});
    mockAttemptRepo.save.mockResolvedValue({});
    jwtService.sign
      .mockReturnValueOnce('signed-refresh-token')
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token')
      .mockReturnValueOnce('signed-refresh-token-2')
      .mockReturnValueOnce('access-token-2')
      .mockReturnValueOnce('refresh-token-2');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateChallenge', () => {
    it('generates a challenge with nonce and message', async () => {
      mockChallengeRepo.save.mockResolvedValue(mockChallenge);

      const result = await service.generateChallenge(WALLET);

      expect(result).toEqual(
        expect.objectContaining({
          nonce: NONCE,
          message: MESSAGE,
        }),
      );
      expect(mockChallengeRepo.delete).toHaveBeenCalledWith({ walletAddress: WALLET });
    });
  });

  describe('verifyChallenge', () => {
    beforeEach(() => {
      mockChallengeRepo.findOne.mockResolvedValue(mockChallenge);
      mockChallengeRepo.delete.mockResolvedValue({});
    });

    it('authenticates an existing user and creates a session', async () => {
      cryptoService.verifyStellarSignature.mockReturnValue(true);
      usersService.findByWalletAddress.mockResolvedValue(mockUser);

      const result = await service.verifyChallenge(WALLET, 'valid-signature', IP, USER_AGENT);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.id).toBe(mockUser.id);
      expect(sessionsService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          refreshTokenHash: 'hashed-token',
          metadata: expect.objectContaining({
            ipAddress: IP,
            userAgent: USER_AGENT,
            deviceInfo: 'Chrome on macOS',
          }),
        }),
      );
    });

    it('creates a user on first login', async () => {
      cryptoService.verifyStellarSignature.mockReturnValue(true);
      usersService.findByWalletAddress.mockRejectedValue(new NotFoundException());
      usersService.create.mockResolvedValue(mockUser);

      const result = await service.verifyChallenge(WALLET, 'valid-signature', IP, USER_AGENT);

      expect(usersService.create).toHaveBeenCalledWith({ walletAddress: WALLET });
      expect(result.user.id).toBe(mockUser.id);
    });

    it('rejects invalid signatures', async () => {
      cryptoService.verifyStellarSignature.mockReturnValue(false);

      await expect(service.verifyChallenge(WALLET, 'bad-signature', IP)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAttemptRepo.save).toHaveBeenCalled();
    });

    it('rejects missing challenges', async () => {
      mockChallengeRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyChallenge(WALLET, 'any-signature', IP)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects deactivated users', async () => {
      cryptoService.verifyStellarSignature.mockReturnValue(true);
      usersService.findByWalletAddress.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.verifyChallenge(WALLET, 'valid-signature', IP)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('blocks repeated failed attempts', async () => {
      mockAttemptRepo.count.mockResolvedValue(5);

      await expect(service.verifyChallenge(WALLET, 'any-sig', IP)).rejects.toThrow(HttpException);
    });
  });

  describe('refreshAccessToken', () => {
    it('rotates the session for a valid refresh token', async () => {
      jwtService.verify.mockReturnValue({
        sub: mockUser.id,
        walletAddress: WALLET,
        sessionId: mockSession.id,
      });
      cryptoService.compareToken.mockResolvedValue(true);
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.refreshAccessToken('valid-refresh-token', IP, USER_AGENT);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(sessionsService.validateRefreshSession).toHaveBeenCalledWith(
        mockUser.id,
        mockSession.id,
      );
      expect(sessionsService.rotateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          currentSessionId: mockSession.id,
          refreshTokenHash: 'hashed-token',
        }),
      );
    });

    it('rejects invalid JWT refresh tokens', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('bad token');
      });

      await expect(service.refreshAccessToken('bad-token', IP)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects refresh tokens with mismatched hashes', async () => {
      jwtService.verify.mockReturnValue({
        sub: mockUser.id,
        walletAddress: WALLET,
        sessionId: mockSession.id,
      });
      cryptoService.compareToken.mockResolvedValue(false);

      await expect(service.refreshAccessToken('tampered-token', IP)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the current session', async () => {
      await service.logout(mockUser.id, mockSession.id);

      expect(sessionsService.revokeSession).toHaveBeenCalledWith(mockUser.id, mockSession.id);
    });

    it('is a no-op when session id is missing', async () => {
      await expect(service.logout(mockUser.id)).resolves.toBeUndefined();
      expect(sessionsService.revokeSession).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('returns user details with the current session id', async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.validateUser({
        sub: mockUser.id,
        walletAddress: WALLET,
        sessionId: mockSession.id,
      });

      expect(result).toEqual(
        expect.objectContaining({ id: mockUser.id, sessionId: mockSession.id }),
      );
      expect(sessionsService.validateActiveSession).toHaveBeenCalledWith(
        mockUser.id,
        mockSession.id,
      );
      expect(sessionsService.touchSession).toHaveBeenCalledWith(mockSession.id);
    });

    it('rejects deactivated users', async () => {
      usersService.findById.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        service.validateUser({
          sub: mockUser.id,
          walletAddress: WALLET,
          sessionId: mockSession.id,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
