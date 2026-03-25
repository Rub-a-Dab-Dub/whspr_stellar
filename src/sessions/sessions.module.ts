import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityNotificationsService } from './security-notifications.service';
import { UserSession } from './entities/user-session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSession])],
  controllers: [SessionsController],
  providers: [SessionsRepository, SessionsService, SecurityNotificationsService],
  exports: [SessionsRepository, SessionsService, SecurityNotificationsService],
})
export class SessionsModule {}
