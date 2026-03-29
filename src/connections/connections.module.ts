import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { ConnectionPushNotifier } from './connection-push.notifier';
import { ConnectionsController } from './connections.controller';
import { ConnectionsRepository } from './connections.repository';
import { ConnectionsService } from './connections.service';
import { ConnectionRequest } from './entities/connection-request.entity';
import { ProfessionalConnection } from './entities/professional-connection.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConnectionRequest, ProfessionalConnection, User]),
    NotificationsModule,
  ],
  controllers: [ConnectionsController],
  providers: [ConnectionsRepository, ConnectionsService, ConnectionPushNotifier],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
