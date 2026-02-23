import { Test, TestingModule } from '@nestjs/testing';
import { RoomExpirationService } from '../services/room-expiration.service';
import { Repository } from 'typeorm';
import { Room, RoomType } from '../entities/room.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('RoomExpirationService', () => {
  let service: RoomExpirationService;
  let roomRepo: Repository<Room>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomExpirationService,
        {
          provide: getRepositoryToken(Room),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RoomExpirationService>(RoomExpirationService);
    roomRepo = module.get<Repository<Room>>(getRepositoryToken(Room));
  });

  it('should extend room expiration', async () => {
    const room = {
      id: '1',
      ownerId: 'user1',
      roomType: RoomType.TIMED,
      expiryTimestamp: Date.now() + 3600000,
      extensionCount: 0,
      isExpired: false,
    } as Room;

    jest.spyOn(roomRepo, 'findOne').mockResolvedValue(room);
    jest.spyOn(roomRepo, 'save').mockResolvedValue(room);

    const result = await service.extendRoom('1', 'user1', { additionalMinutes: 60 });
    expect(result.extensionCount).toBe(1);
  });
});
