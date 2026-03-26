import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminUsersService } from './admin-users.service';
import { User, UserTier } from '../../users/entities/user.entity';
import { Repository } from 'typeorm';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let repo: Repository<User>;

  const mockUsers = [
    { id: '1', username: 'user1', isActive: true, tier: UserTier.SILVER },
    { id: '2', username: 'user2', isActive: false, tier: UserTier.GOLD },
  ];

  const mockUserRepository = {
    find: jest.fn().mockResolvedValue(mockUsers),
    findOne: jest.fn().mockImplementation(({ where: { id } }) => {
      const user = mockUsers.find((u) => u.id === id);
      return Promise.resolve(user || null);
    }),
    save: jest.fn().mockImplementation((user) => Promise.resolve(user)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
    repo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all users', async () => {
    const users = await service.findAll();
    expect(users).toEqual(mockUsers);
    expect(repo.find).toHaveBeenCalled();
  });

  it('should return one user', async () => {
    const user = await service.findOne('1');
    expect(user).toEqual(mockUsers[0]);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('should change status of a user', async () => {
    const user = await service.setStatus('1', false);
    expect(user.isActive).toBe(false);
    expect(repo.save).toHaveBeenCalled();
  });

  it('should change tier of a user', async () => {
    const user = await service.setTier('2', UserTier.BLACK);
    expect(user.tier).toBe(UserTier.BLACK);
    expect(repo.save).toHaveBeenCalled();
  });
});
