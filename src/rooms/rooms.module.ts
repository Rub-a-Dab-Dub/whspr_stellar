import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Room } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { RoomStats } from './entities/room-stats.entity';
import { RoomBlockchainService } from './services/room-blockchain.service';
import { RoomTrendingCronService } from './services/room-trending-cron.service';
import { RoomStatsService } from './services/room-stats.service';
import { RoomStatsListener } from './listeners/room-stats.listener';
import { RoomsGateway } from './gateways/rooms.gateway';
import { UserModule } from '../user/user.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomMember, RoomStats]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    UserModule,
    AnalyticsModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomBlockchainService, RoomTrendingCronService, RoomStatsService, RoomStatsListener, RoomsGateway],
  exports: [RoomsService, RoomStatsService],
})
export class RoomsModule {}
