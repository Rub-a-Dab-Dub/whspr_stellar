import { SeedService } from './seed.service';

describe('SeedService', () => {
  let service: SeedService;
  const savedUsers: any[] = [];
  const savedRooms: any[] = [];

  const userRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((d) => d),
    save: jest.fn((d) => { savedUsers.push(d); return Promise.resolve({ ...d, id: 'uuid-1' }); }),
  };

  const roomRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((d) => d),
    save: jest.fn((d) => { savedRooms.push(d); return Promise.resolve(d); }),
  };

  const configService = {
    get: jest.fn((key: string, def: string) => (key === 'NODE_ENV' ? 'development' : def)),
  };

  beforeEach(() => {
    savedUsers.length = 0;
    savedRooms.length = 0;
    userRepo.findOne.mockResolvedValue(null);
    service = new SeedService(userRepo as any, roomRepo as any, configService as any);
  });

  it('should seed 5 users in development', async () => {
    // After seedUsers runs, findOne for rooms needs the admin user
    userRepo.findOne.mockImplementation(({ where }: any) => {
      if (where.username === 'admin_seed') return Promise.resolve({ id: 'uuid-1' });
      return Promise.resolve(null);
    });

    await service.run();
    expect(userRepo.save).toHaveBeenCalledTimes(5);
  });

  it('should block seeding in production', async () => {
    const prodConfig = {
      get: jest.fn((key: string, def: string) => (key === 'NODE_ENV' ? 'production' : def)),
    };
    const prodUserRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const prodRoomRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const prodService = new SeedService(prodUserRepo as any, prodRoomRepo as any, prodConfig as any);
    await prodService.run();
    expect(prodUserRepo.save).not.toHaveBeenCalled();
  });
});
