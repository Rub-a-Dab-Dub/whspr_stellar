import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { RoomBlockchainService } from './services/room-blockchain.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Room, RoomMember]), UserModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomBlockchainService],
  exports: [RoomsService],
})
export class RoomsModule {}