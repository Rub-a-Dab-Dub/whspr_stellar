import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../cache/cache.module';
import { RedisModule } from '../redis/redis.module';
import { QueueModule } from '../queue/queue.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ChainModule } from '../chain/chain.module';
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';

// Entities
import { Room } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { RoomInvitation } from './entities/room-invitation.entity';
import { RoomPayment } from './entities/room-payment.entity';
import { UserRoomAccess } from './entities/user-room-access.entity';
import { RoomBan } from './entities/room-ban.entity';
import { RoomWhitelist } from './entities/room-whitelist.entity';
import { RoomEmergencyPause } from './entities/room-emergency-pause.entity';
import { RoomSearchAnalytics } from './entities/room-search-analytics.entity';
import { ArchivedMessage } from '../message/entities/archived-message.entity';

// Controllers
import {
  RoomController,
  RoomPaymentController,
  RoomSettingsController,
} from './room.controller';
import { RoomSearchController } from './controllers/room-search.controller';
import { RoomMemberController } from './room-member.controller';
import { RoomInvitationController } from './room-invitation.controller';
import { RoomRoleController } from './room-role.controller';

// Services
import { RoomService, RoomSettingsService } from './room.service';
import { RoomSearchService } from './services/room-search.service';
import { RoomMemberService } from './services/room-member.service';
import { RoomInvitationService } from './services/room-invitation.service';
import { MemberPermissionsService } from './services/member-permissions.service';
import { MemberActivityService } from './services/member-activity.service';
import { RoomAnalyticsService } from './room-analytics.service';
import { PaymentVerificationService } from './services/payment-verification.service';
import { RoomPaymentService } from './services/room-payment.service';
import { RoomRoleService } from './services/room-role.service';
import { RoomExpirationService } from './services/room-expiration.service';

// Repositories
import { RoomMemberRepository } from './repositories/room-member.repository';
import { RoomInvitationRepository } from './repositories/room-invitation.repository';
import { RoomRepository } from './repositories/room.repository';

// Guards
import { MemberGuard } from './guards/member.guard';
import { MemberPermissionGuard } from './guards/member-permission.guard';
import { RoomAdminGuard } from './guards/room-admin.guard';
import { RoomModeratorGuard } from './guards/room-moderator.guard';
import { RoomAccessGuard } from './guards/room-access.guard';

// Gateways
import { MessagesGateway } from '../message/gateways/messages.gateway';

// Jobs
import { InvitationExpirationJob } from './jobs/invitation-expiration.job';
import { PaymentExpirationJob } from './jobs/payment-expiration.job';
import { RoomExpirationProcessor } from './jobs/room-expiration.processor';
import { RoomExpirationScheduler } from './jobs/room-expiration.scheduler';
import { BullModule } from '@nestjs/bull';
import { Message } from '../message/entities/message.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      RoomMember,
      RoomInvitation,
      RoomPayment,
      UserRoomAccess,
      RoomBan,
      RoomWhitelist,
      RoomEmergencyPause,
      RoomSearchAnalytics,
      ArchivedMessage,
      Message,
    ]),
    BullModule.registerQueue({ name: 'room-expiration' }),
    ChainModule,
    CacheModule,
    RedisModule,
    QueueModule,
    ScheduleModule.forRoot(),
    UsersModule,
    AdminModule,
    NotificationsModule,
  ],
  controllers: [
    RoomSearchController,  // must be registered before RoomController to avoid :id swallowing /search
    RoomController,
    RoomSettingsController,
    RoomPaymentController,
    RoomMemberController,
    RoomInvitationController,
    RoomRoleController,
  ],
  providers: [
    RoomService,
    RoomSettingsService,
    RoomSearchService,
    RoomMemberService,
    RoomInvitationService,
    MemberPermissionsService,
    MemberActivityService,
    RoomAnalyticsService,
    PaymentVerificationService,
    RoomPaymentService,
    RoomRoleService,
    RoomExpirationService,
    RoomMemberRepository,
    RoomInvitationRepository,
    RoomRepository,
    MemberGuard,
    MemberPermissionGuard,
    RoomAdminGuard,
    RoomModeratorGuard,
    RoomAccessGuard,
    MessagesGateway,
    InvitationExpirationJob,
    PaymentExpirationJob,
    RoomExpirationProcessor,
    RoomExpirationScheduler,
  ],
  exports: [
    RoomService,
    RoomMemberService,
    RoomInvitationService,
    MemberPermissionsService,
    MemberActivityService,
    RoomMemberRepository,
    RoomInvitationRepository,
    RoomPaymentService,
    RoomRoleService,
    RoomAccessGuard,
  ],
})
export class RoomModule {}
