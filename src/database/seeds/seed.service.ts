import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../../user/entities/user.entity';
import { Room, RoomType } from '../../rooms/entities/room.entity';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    private readonly configService: ConfigService,
  ) {}

  async run(): Promise<void> {
    const env = this.configService.get<string>('NODE_ENV', 'development');
    if (env === 'production') {
      this.logger.error('Seeding is blocked in production!');
      return;
    }

    this.logger.log('Seeding database...');
    await this.seedUsers();
    await this.seedRooms();
    this.logger.log('Seeding complete.');
  }

  private async seedUsers(): Promise<void> {
    const testUsers = [
      { walletAddress: '0x1111111111111111111111111111111111111111', role: UserRole.ADMIN, username: 'admin_seed' },
      { walletAddress: '0x2222222222222222222222222222222222222222', role: UserRole.MODERATOR, username: 'mod_seed' },
      { walletAddress: '0x3333333333333333333333333333333333333333', role: UserRole.ROOM_CREATOR, username: 'creator_seed' },
      { walletAddress: '0x4444444444444444444444444444444444444444', role: UserRole.USER, username: 'user_seed_1' },
      { walletAddress: '0x5555555555555555555555555555555555555555', role: UserRole.USER, username: 'user_seed_2' },
    ];

    for (const data of testUsers) {
      const exists = await this.userRepo.findOne({ where: { walletAddress: data.walletAddress } });
      if (!exists) {
        await this.userRepo.save(this.userRepo.create(data));
        this.logger.log(`Created user: ${data.username}`);
      }
    }
  }

  private async seedRooms(): Promise<void> {
    const admin = await this.userRepo.findOne({ where: { username: 'admin_seed' } });
    if (!admin) return;

    const testRooms = [
      { name: 'General Chat', type: RoomType.PUBLIC, description: 'Public discussion room' },
      { name: 'VIP Room', type: RoomType.TOKEN_GATED, description: 'Token-gated access only' },
      { name: 'Timed Event', type: RoomType.TIMED, description: 'Temporary event room' },
    ];

    for (const data of testRooms) {
      const exists = await this.roomRepo.findOne({ where: { name: data.name } });
      if (!exists) {
        await this.roomRepo.save(this.roomRepo.create({ ...data, creatorId: admin.id }));
        this.logger.log(`Created room: ${data.name}`);
      }
    }
  }
}
