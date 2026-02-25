import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity';

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;
  let queryBuilder: SelectQueryBuilder<User>;

  const mockUsers = [
    {
      id: '1',
      username: 'john_doe',
      avatarUrl: 'avatar1.jpg',
      level: 5,
      isOnline: true,
      walletAddress: 'GCKFBEIYTKP...',
    },
    {
      id: '2',
      username: 'jane_smith',
      avatarUrl: null,
      level: 3,
      isOnline: false,
      walletAddress: 'GDQNY2CQKMR...',
    },
    {
      id: '3',
      username: 'johnny',
      avatarUrl: 'avatar3.jpg',
      level: 7,
      isOnline: true,
      walletAddress: 'GAHK7EEG2WW...',
    },
  ];

  beforeEach(async () => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    } as any;

    const mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  describe('searchUsers', () => {
    it('should search users with proper query structure', async () => {
      queryBuilder.getMany = jest.fn().mockResolvedValue(mockUsers);

      await service.searchUsers('john');

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(queryBuilder.select).toHaveBeenCalledWith([
        'user.id',
        'user.username',
        'user.avatarUrl',
        'user.level',
        'user.isOnline',
        'user.walletAddress',
      ]);
      expect(queryBuilder.where).toHaveBeenCalledWith('user.deletedAt IS NULL');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.isBanned = false');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.suspendedUntil IS NULL OR user.suspendedUntil < NOW()',
      );
    });

    it('should apply fuzzy matching with ILIKE and similarity', async () => {
      queryBuilder.getMany = jest.fn().mockResolvedValue(mockUsers);

      await service.searchUsers('john');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(user.username ILIKE :query OR user.walletAddress ILIKE :walletQuery OR similarity(user.username, :rawQuery) > 0.3)',
        { query: '%john%', walletQuery: 'john%', rawQuery: 'john' },
      );
    });

    it('should order results by relevance (exact match, similarity, level, online status)', async () => {
      queryBuilder.getMany = jest.fn().mockResolvedValue(mockUsers);

      await service.searchUsers('john');

      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'CASE WHEN user.username ILIKE :exactQuery THEN 1 WHEN user.walletAddress ILIKE :exactWalletQuery THEN 2 ELSE 3 END',
        'ASC'
      );
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
        'similarity(user.username, :rawQuery)',
        'DESC',
      );
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('user.level', 'DESC');
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('user.isOnline', 'DESC');
      expect(queryBuilder.setParameter).toHaveBeenCalledWith('exactQuery', 'john');
      expect(queryBuilder.setParameter).toHaveBeenCalledWith('exactWalletQuery', 'john%');
      expect(queryBuilder.setParameter).toHaveBeenCalledWith('rawQuery', 'john');
    });

    it('should limit results to 20', async () => {
      queryBuilder.getMany = jest.fn().mockResolvedValue(mockUsers);

      await service.searchUsers('john');

      expect(queryBuilder.limit).toHaveBeenCalledWith(20);
    });

    it('should return mapped user search results', async () => {
      queryBuilder.getMany = jest.fn().mockResolvedValue(mockUsers);

      const result = await service.searchUsers('john');

      expect(result).toEqual([
        {
          id: '1',
          username: 'john_doe',
          avatarUrl: 'avatar1.jpg',
          level: 5,
          isOnline: true,
        },
        {
          id: '2',
          username: 'jane_smith',
          avatarUrl: null,
          level: 3,
          isOnline: false,
        },
        {
          id: '3',
          username: 'johnny',
          avatarUrl: 'avatar3.jpg',
          level: 7,
          isOnline: true,
        },
      ]);
    });

    it('should handle wallet address search', async () => {
      queryBuilder.getMany = jest.fn().mockResolvedValue([mockUsers[0]]);

      await service.searchUsers('GCKFBEIYTKP');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(user.username ILIKE :query OR user.walletAddress ILIKE :walletQuery OR similarity(user.username, :rawQuery) > 0.3)',
        { query: '%GCKFBEIYTKP%', walletQuery: 'GCKFBEIYTKP%', rawQuery: 'GCKFBEIYTKP' },
      );
    });

    it('should exclude banned users', async () => {
      queryBuilder.getMany = jest.fn().mockResolvedValue([]);

      await service.searchUsers('banned_user');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.isBanned = false');
    });

    it('should exclude suspended users', async () => {
      queryBuilder.getMany = jest.fn().mockResolvedValue([]);

      await service.searchUsers('suspended_user');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.suspendedUntil IS NULL OR user.suspendedUntil < NOW()',
      );
    });

    it('should exclude soft-deleted users', async () => {
      queryBuilder.getMany = jest.fn().mockResolvedValue([]);

      await service.searchUsers('deleted_user');

      expect(queryBuilder.where).toHaveBeenCalledWith('user.deletedAt IS NULL');
    });

    it('should trim whitespace from search query', async () => {
      queryBuilder.getMany = jest.fn().mockResolvedValue(mockUsers);

      await service.searchUsers('  john  ');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(user.username ILIKE :query OR user.walletAddress ILIKE :walletQuery OR similarity(user.username, :rawQuery) > 0.3)',
        { query: '%john%', walletQuery: 'john%', rawQuery: 'john' },
      );
    });
  });
});
