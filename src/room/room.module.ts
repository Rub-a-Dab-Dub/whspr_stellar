import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../cache/cache.module';
import { RedisModule } from '../redis/redis.module';
import { QueueModule } from '../queue/queue.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ChainModule } from '../chain/chain.module';
import { UsersModule } from '../users/users.module';

// Entities
import { Room } from './entities/room.entity';
import { RoomMember } from './entities/room-member.entity';
import { RoomInvitation } from './entities/room-invitation.entity';
import { RoomPayment } from './entities/room-payment.entity';
import { UserRoomAccess } from './entities/user-room-access.entity';
import { RoomBan } from './entities/room-ban.entity';
import { RoomWhitelist } from './entities/room-whitelist.entity';
import { RoomEmergencyPause } from './entities/room-emergency-pause.entity';

// Controllers
import {
  RoomController,
  RoomPaymentController,
  RoomSettingsController,
} from './room.controller';
import { RoomMemberController } from './room-member.controller';
import { RoomInvitationController } from './room-invitation.controller';
import { RoomRoleController } from './room-role.controller';

// Services
import { RoomService, RoomSettingsService } from './room.service';
import { RoomMemberService } from './services/room-member.service';
import { RoomInvitationService } from './services/room-invitation.service';
import { MemberPermissionsService } from './services/member-permissions.service';
import { MemberActivityService } from './services/member-activity.service';
import { RoomAnalyticsService } from './room-analytics.service';
import { PaymentVerificationService } from './services/payment-verification.service';
import { RoomPaymentService } from './services/room-payment.service';
import { RoomRoleService } from './services/room-role.service';

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
    ]),
    ChainModule,
    CacheModule,
    RedisModule,
    QueueModule,
    ScheduleModule.forRoot(),
    UsersModule,
  ],
  controllers: [
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
    RoomMemberService,
    RoomInvitationService,
    MemberPermissionsService,
    MemberActivityService,
    RoomAnalyticsService,
    PaymentVerificationService,
    RoomPaymentService,
    RoomRoleService,
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
export class RoomModule { }
