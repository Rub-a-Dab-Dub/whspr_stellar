import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  const mockUserService = {
    searchUsers: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 30,
          },
        ]),
      ],
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  describe('searchUsers', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should call userService.searchUsers with correct query', async () => {
      const mockResults = [
        {
          id: '1',
          username: 'john_doe',
          avatarUrl: 'avatar1.jpg',
          level: 5,
          isOnline: true,
        },
      ];

      mockUserService.searchUsers.mockResolvedValue(mockResults);

      const result = await controller.searchUsers({ q: 'john' });

      expect(userService.searchUsers).toHaveBeenCalledWith('john');
      expect(result).toEqual(mockResults);
    });

    it('should handle empty search results', async () => {
      mockUserService.searchUsers.mockResolvedValue([]);

      const result = await controller.searchUsers({ q: 'nonexistent' });

      expect(userService.searchUsers).toHaveBeenCalledWith('nonexistent');
      expect(result).toEqual([]);
    });

    it('should handle wallet address search', async () => {
      const mockResults = [
        {
          id: '1',
          username: 'crypto_user',
          avatarUrl: null,
          level: 3,
          isOnline: false,
        },
      ];

      mockUserService.searchUsers.mockResolvedValue(mockResults);

      const result = await controller.searchUsers({ q: 'GCKFBEIYTKP' });

      expect(userService.searchUsers).toHaveBeenCalledWith('GCKFBEIYTKP');
      expect(result).toEqual(mockResults);
    });
  });
});
