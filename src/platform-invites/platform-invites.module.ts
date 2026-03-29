import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from '../admin/entities/system-setting.entity';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/entities/user.entity';
import { AdminPlatformInvitesController } from './admin-platform-invites.controller';
import { PlatformInviteRedemption } from './entities/platform-invite-redemption.entity';
import { PlatformInvite } from './entities/platform-invite.entity';
import { InviteModeService } from './invite-mode.service';
import { PlatformInviteService } from './platform-invite.service';
import { PublicInvitesController } from './public-invites.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformInvite, PlatformInviteRedemption, SystemSetting, User]),
    MailModule,
  ],
  controllers: [AdminPlatformInvitesController, PublicInvitesController],
  providers: [PlatformInviteService, InviteModeService],
  exports: [PlatformInviteService, InviteModeService],
})
export class PlatformInvitesModule {}
