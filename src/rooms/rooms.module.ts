import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Room } from './entities/room.entity';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomCleanupTask } from './tasks/room-cleanup.task';
import { RoomEventsListener } from './listeners/room-events.listener';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room]),
    ScheduleModule.forRoot(),
    UsersModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomCleanupTask, RoomEventsListener],
  exports: [RoomsService],
})