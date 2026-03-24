import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import { UsersService } from '../../users/users.service';
import { AuthChallenge } from '../entities/auth-challenge.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { AuthAttempt } from '../entities/auth-attempt.entity';
import { UserTier } from '../../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let cryptoService: jest.Mocked<CryptoService>;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const WALLET = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';
  const IP = '127.0.0.1';
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

  const mockRefreshToken: RefreshToken = {
    id: 'token-uuid',
    userId: 'user-uuid',
    user: {} as any,
    tokenHash: 'hashed-token',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    isRevoked: false,
    ipAddress: IP,
    userAgent: null,
    createdAt: new Date(),
  };

  const mockChallengeRepo = {
    delete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockRefreshTokenRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  const mockAttemptRepo = {
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
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
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        { provide: getRepositoryToken(AuthChallenge), useValue: mockChallengeRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo },
        { provide: getRepositoryToken(AuthAttempt), useValue: mockAttemptRepo },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    cryptoService = module.get(CryptoService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
    mockAttemptRepo.count.mockResolvedValue(0);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateChallenge', () => {
    it('should generate a challenge with nonce and message', async () => {
      mockChallengeRepo.delete.mockResolvedValue({});
      mockChallengeRepo.create.mockReturnValue(mockChallenge);
      mockChallengeRepo.save.mockResolvedValue(mockChallenge);

      const result = await service.generateChallenge(WALLET);

      expect(result.nonce).toBe(NONCE);
      expect(result.message).toBe(MESSAGE);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockChallengeRepo.delete).toHaveBeenCalledWith({ walletAddress: WALLET });
      expect(mockChallengeRepo.save).toHaveBeenCalled();
    });
  });

  describe('verifyChallenge', () => {
    beforeEach(() => {
      mockChallengeRepo.findOne.mockResolvedValue(mockChallenge);
      mockChallengeRepo.delete.mockResolvedValue({});
      mockAttemptRepo.create.mockReturnValue({});
      mockAttemptRepo.save.mockResolvedValue({});
      mockRefreshTokenRepo.create.mockReturnValue(mockRefreshToken);
      mockRefreshTokenRepo.save.mockResolvedValue(mockRefreshToken);
    });

    it('should authenticate and return tokens for existing user', async () => {
      cryptoService.verifyStellarSignature.mockReturnValue(true);
      usersService.findByWalletAddress.mockResolvedValue(mockUser);

      const result = await service.verifyChallenge(WALLET, 'valid-sig', IP);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
      expect(result.user.id).toBe(mockUser.id);
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(900);
    });

    it('should create new user on first login', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      cryptoService.verifyStellarSignature.mockReturnValue(true);
      usersService.findByWalletAddress.mockRejectedValue(new NotFoundException());
      usersService.create.mockResolvedValue(mockUser);

      const result = await service.verifyChallenge(WALLET, 'valid-sig', IP);

      expect(usersService.create).toHaveBeenCalledWith({ walletAddress: WALLET });
      expect(result.user.id).toBe(mockUser.id);
    });

    it('should throw UnauthorizedException for invalid signature', async () => {
      cryptoService.verifyStellarSignature.mockReturnValue(false);

      await expect(service.verifyChallenge(WALLET, 'bad-sig', IP)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAttemptRepo.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when challenge not found', async () => {
      mockChallengeRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyChallenge(WALLET, 'any-sig', IP)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for deactivated user', async () => {
      cryptoService.verifyStellarSignature.mockReturnValue(true);
      usersService.findByWalletAddress.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.verifyChallenge(WALLET, 'valid-sig', IP)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw 429 after too many failed attempts', async () => {
      mockAttemptRepo.count.mockResolvedValue(5);

      await expect(service.verifyChallenge(WALLET, 'any-sig', IP)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should issue new tokens with valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-uuid', walletAddress: WALLET });
      mockRefreshTokenRepo.findOne.mockResolvedValue(mockRefreshToken);
      cryptoService.compareToken.mockResolvedValue(true);
      mockRefreshTokenRepo.save.mockResolvedValue({ ...mockRefreshToken, isRevoked: true });
      mockRefreshTokenRepo.create.mockReturnValue(mockRefreshToken);
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.refreshAccessToken('valid-refresh-token', IP);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.id).toBe(mockUser.id);
      // Old token should be revoked
      expect(mockRefreshTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isRevoked: true }),
      );
    });

    it('should throw UnauthorizedException for invalid JWT', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refreshAccessToken('bad-token', IP)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when stored token not found', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-uuid', walletAddress: WALLET });
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refreshAccessToken('valid-jwt-bad-db', IP)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token hash does not match', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-uuid', walletAddress: WALLET });
      mockRefreshTokenRepo.findOne.mockResolvedValue(mockRefreshToken);
      cryptoService.compareToken.mockResolvedValue(false);

      await expect(service.refreshAccessToken('tampered-token', IP)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(mockRefreshToken);
      mockRefreshTokenRepo.save.mockResolvedValue({ ...mockRefreshToken, isRevoked: true });

      await service.logout('user-uuid', 'some-refresh-token');

      expect(mockRefreshTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isRevoked: true }),
      );
    });

    it('should not throw if token not found', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.logout('user-uuid', 'missing-token')).resolves.not.toThrow();
    });
  });

  describe('validateUser', () => {
    it('should return user for valid payload', async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.validateUser({ sub: 'user-uuid', walletAddress: WALLET });

      expect(result.id).toBe(mockUser.id);
    });

    it('should throw UnauthorizedException for deactivated user', async () => {
      usersService.findById.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        service.validateUser({ sub: 'user-uuid', walletAddress: WALLET }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
