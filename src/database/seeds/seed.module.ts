import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SeedService } from './seed.service';
import { User } from '../../user/entities/user.entity';
import { Room } from '../../rooms/entities/room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Room]), ConfigModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
