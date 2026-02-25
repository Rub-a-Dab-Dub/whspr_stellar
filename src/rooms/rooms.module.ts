import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { RoomBlockchainService } from './services/room-blockchain.service';
import { RoomTrendingCronService } from './services/room-trending-cron.service';
import { UserModule } from '../user/user.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomMember]),
    ScheduleModule.forRoot(),
    UserModule,
    AnalyticsModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomBlockchainService, RoomTrendingCronService],
  exports: [RoomsService],
})
export class RoomsModule {}
