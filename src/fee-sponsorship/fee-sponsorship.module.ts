import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from '../admin/entities/system-setting.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { User } from '../users/entities/user.entity';
import { AdminFeeSponsorshipController } from './admin-fee-sponsorship.controller';
import { FeeSponsorship } from './entities/fee-sponsorship.entity';
import { SponsorshipQuota } from './entities/sponsorship-quota.entity';
import { FeeSponsorshipController } from './fee-sponsorship.controller';
import { FeeSponsorshipService } from './fee-sponsorship.service';
import { StellarFeeBumpService } from './stellar-fee-bump.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeeSponsorship, SponsorshipQuota, User, Referral, SystemSetting]),
  ],
  controllers: [FeeSponsorshipController, AdminFeeSponsorshipController],
  providers: [FeeSponsorshipService, StellarFeeBumpService],
  exports: [FeeSponsorshipService, StellarFeeBumpService],
})
export class FeeSponsorshipModule {}
