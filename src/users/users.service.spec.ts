import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { User, UserTier } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { TranslationService } from '../i18n/services/translation.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    walletAddress: '0x742d35cc6634c0532925a3b844bc9e7595f0beb',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    bio: 'Test bio',
    preferredLocale: null,
    tier: UserTier.FREE,
    isActive: true,
    isVerified: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findByWalletAddress: jest.fn(),
    findByUsername: jest.fn(),
    findByEmail: jest.fn(),
    findActiveUsers: jest.fn(),
    isUsernameAvailable: jest.fn(),
    isEmailAvailable: jest.fn(),
    isWalletAddressAvailable: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: mockRepository,
        },
        {
          provide: TranslationService,
          useValue: {
            translate: jest.fn((key: string) => key),
            normalizeSupportedLocale: jest.fn((locale?: string | null) => locale ?? null),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(UsersRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      username: 'newuser',
      email: 'new@example.com',
    };

    it('should create a new user successfully', async () => {
      repository.findByWalletAddress.mockResolvedValue(null);
      repository.findByUsername.mockResolvedValue(null);
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockReturnValue(mockUser);
      repository.save.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
      expect(result.username).toBe(mockUser.username);
      expect(repository.findByWalletAddress).toHaveBeenCalledWith(
        createUserDto.walletAddress,
      );
      expect(repository.findByUsername).toHaveBeenCalledWith(createUserDto.username);
      expect(repository.findByEmail).toHaveBeenCalledWith(createUserDto.email);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if wallet address exists', async () => {
      repository.findByWalletAddress.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(repository.findByWalletAddress).toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if username exists', async () => {
      repository.findByWalletAddress.mockResolvedValue(null);
      repository.findByUsername.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(repository.findByUsername).toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      repository.findByWalletAddress.mockResolvedValue(null);
      repository.findByUsername.mockResolvedValue(null);
      repository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(repository.findByEmail).toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should create user without optional fields', async () => {
      const minimalDto: CreateUserDto = {
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      };

      repository.findByWalletAddress.mockResolvedValue(null);
      repository.create.mockReturnValue(mockUser);
      repository.save.mockResolvedValue(mockUser);

      const result = await service.create(minimalDto);

      expect(result).toBeDefined();
      expect(repository.findByUsername).not.toHaveBeenCalled();
      expect(repository.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: mockUser.id } });
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUsername', () => {
    it('should return user by username', async () => {
      repository.findByUsername.mockResolvedValue(mockUser);

      const result = await service.findByUsername(mockUser.username!);

      expect(result).toBeDefined();
      expect(result.username).toBe(mockUser.username);
      expect(repository.findByUsername).toHaveBeenCalledWith(mockUser.username);
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findByUsername.mockResolvedValue(null);

      await expect(service.findByUsername('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByWalletAddress', () => {
    it('should return user by wallet address', async () => {
      repository.findByWalletAddress.mockResolvedValue(mockUser);

      const result = await service.findByWalletAddress(mockUser.walletAddress);

      expect(result).toBeDefined();
      expect(result.walletAddress).toBe(mockUser.walletAddress);
      expect(repository.findByWalletAddress).toHaveBeenCalledWith(mockUser.walletAddress);
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findByWalletAddress.mockResolvedValue(null);

      await expect(service.findByWalletAddress('0xinvalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateProfileDto = {
      displayName: 'Updated Name',
      bio: 'Updated bio',
    };

    it('should update user profile successfully', async () => {
      const updatedUser = { ...mockUser, ...updateDto };
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(mockUser.id, updateDto);

      expect(result).toBeDefined();
      expect(result.displayName).toBe(updateDto.displayName);
      expect(result.bio).toBe(updateDto.bio);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.updateProfile('non-existent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should check username availability when updating username', async () => {
      const updateWithUsername: UpdateProfileDto = {
        username: 'newusername',
      };

      repository.findOne.mockResolvedValue(mockUser);
      repository.isUsernameAvailable.mockResolvedValue(true);
      repository.save.mockResolvedValue({ ...mockUser, username: 'newusername' });

      await service.updateProfile(mockUser.id, updateWithUsername);

      expect(repository.isUsernameAvailable).toHaveBeenCalledWith('newusername', mockUser.id);
    });

    it('should throw ConflictException if username is taken', async () => {
      const updateWithUsername: UpdateProfileDto = {
        username: 'takenusername',
      };

      repository.findOne.mockResolvedValue(mockUser);
      repository.isUsernameAvailable.mockResolvedValue(false);

      await expect(service.updateProfile(mockUser.id, updateWithUsername)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should check email availability when updating email', async () => {
      const updateWithEmail: UpdateProfileDto = {
        email: 'newemail@example.com',
      };

      repository.findOne.mockResolvedValue(mockUser);
      repository.isEmailAvailable.mockResolvedValue(true);
      repository.save.mockResolvedValue({ ...mockUser, email: 'newemail@example.com' });

      await service.updateProfile(mockUser.id, updateWithEmail);

      expect(repository.isEmailAvailable).toHaveBeenCalledWith(
        'newemail@example.com',
        mockUser.id,
      );
    });

    it('should throw ConflictException if email is taken', async () => {
      const updateWithEmail: UpdateProfileDto = {
        email: 'taken@example.com',
      };

      repository.findOne.mockResolvedValue(mockUser);
      repository.isEmailAvailable.mockResolvedValue(false);

      await expect(service.updateProfile(mockUser.id, updateWithEmail)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should deactivate user successfully', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({ ...mockUser, isActive: false });

      await service.deactivate(mockUser.id);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.deactivate('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user already deactivated', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      repository.findOne.mockResolvedValue(inactiveUser);

      await expect(service.deactivate(mockUser.id)).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('paginate', () => {
    it('should return paginated users', async () => {
      const users = [mockUser, { ...mockUser, id: 'another-id' }];
      repository.findActiveUsers.mockResolvedValue([users, 2]);

      const result = await service.paginate({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should calculate total pages correctly', async () => {
      const users = Array(25).fill(mockUser);
      repository.findActiveUsers.mockResolvedValue([users.slice(0, 10), 25]);

      const result = await service.paginate({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });
  });
});
