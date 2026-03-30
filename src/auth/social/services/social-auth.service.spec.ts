import { Test, TestingModule } from '@nestjs/testing';
import { SocialAuthService } from './social-auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SocialAccount, SocialProvider } from '../entities/social-account.entity';
import { UsersService } from '../../../users/users.service';
import { AuthService } from '../../services/auth.service';
import { CryptoService } from '../../services/crypto.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('SocialAuthService', () => {
  let service: SocialAuthService;

  const mockSocialAccountRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
  };

  const mockAuthService = {
    issueTokensForUser: jest.fn(),
  };

  const mockCryptoService = {
    encryptSymmetric: jest.fn().mockImplementation((val) => 'encrypted_' + val),
    decryptSymmetric: jest.fn().mockImplementation((val) => val.replace('encrypted_', '')),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialAuthService,
        {
          provide: getRepositoryToken(SocialAccount),
          useValue: mockSocialAccountRepository,
        },
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: CryptoService, useValue: mockCryptoService },
      ],
    }).compile();

    service = module.get<SocialAuthService>(SocialAuthService);
    jest.clearAllMocks();
  });

  describe('loginWithSocial', () => {
    const profile = {
      id: '12345',
      emails: [{ value: 'test@example.com' }],
      displayName: 'Test User',
      photos: [{ value: 'photo_url' }],
    };
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };
    const req = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' }, connection: {} };

    it('should link new social account to existing user by email', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(null);
      const existingUser = { id: 'user_123', walletAddress: 'G_WALLET' };
      mockUsersService.findByEmail.mockResolvedValue(existingUser);
      mockSocialAccountRepository.create.mockReturnValue({ id: 'sa_1' });
      mockSocialAccountRepository.save.mockResolvedValue({ id: 'sa_1' });
      mockAuthService.issueTokensForUser.mockResolvedValue({ accessToken: 'jwt' });

      const result = await service.loginWithSocial(SocialProvider.GOOGLE, profile, tokens, req);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockSocialAccountRepository.create).toHaveBeenCalled();
      expect(mockAuthService.issueTokensForUser).toHaveBeenCalledWith(existingUser, '127.0.0.1', 'jest');
      expect(result).toEqual({ accessToken: 'jwt' });
    });

    it('should create a new user and social account if email is not found', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(null);
      mockUsersService.findByEmail.mockRejectedValue(new NotFoundException());
      
      const newUser = { id: 'user_123', walletAddress: null };
      mockUsersService.create.mockResolvedValue(newUser);
      
      mockSocialAccountRepository.create.mockReturnValue({ id: 'sa_1' });
      mockSocialAccountRepository.save.mockResolvedValue({ id: 'sa_1' });
      mockAuthService.issueTokensForUser.mockResolvedValue({ accessToken: 'jwt' });

      const result = await service.loginWithSocial(SocialProvider.GOOGLE, profile, tokens, req);

      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'photo_url',
      });
      expect(result).toBeDefined();
    });
  });

  describe('linkAccount', () => {
    const profile = {
      id: '12345',
      emails: [{ value: 'test@example.com' }],
    };
    const tokens = { accessToken: 'access' };

    it('should link account successfully', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(null);
      mockSocialAccountRepository.create.mockReturnValue({ id: 'sa_1' });
      mockSocialAccountRepository.save.mockResolvedValue({ id: 'sa_1' });

      const result = await service.linkAccount('user_123', SocialProvider.GITHUB, profile, tokens);
      
      expect(mockSocialAccountRepository.create).toHaveBeenCalled();
      expect(result).toEqual({ id: 'sa_1' });
    });

    it('should throw conflict if already linked to same user', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue({ userId: 'user_123' });
      
      await expect(service.linkAccount('user_123', SocialProvider.GITHUB, profile, tokens))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('unlinkAccount', () => {
    it('should correctly unlink if wallet address exists', async () => {
      mockSocialAccountRepository.find.mockResolvedValue([{ id: 'sa_1', provider: SocialProvider.GITHUB }]);
      mockUsersService.findById.mockResolvedValue({ id: 'user_1', walletAddress: 'Gxxx' });
      mockSocialAccountRepository.delete.mockResolvedValue({});

      await service.unlinkAccount('user_1', SocialProvider.GITHUB);

      expect(mockSocialAccountRepository.delete).toHaveBeenCalledWith('sa_1');
    });

    it('should throw BadRequest if it is the last auth method and walletAddress is null', async () => {
      mockSocialAccountRepository.find.mockResolvedValue([{ id: 'sa_1', provider: SocialProvider.GITHUB }]);
      mockUsersService.findById.mockResolvedValue({ id: 'user_1', walletAddress: null });

      await expect(service.unlinkAccount('user_1', SocialProvider.GITHUB))
        .rejects.toThrow(BadRequestException);
    });
  });
});
