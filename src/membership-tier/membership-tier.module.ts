import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipTierService } from './membership-tier.service';
import { MembershipTierController } from './membership-tier.controller';
import { UsersModule } from '../users/users.module';
import { TwoFactorModule } from '../two-factor/two-factor.module';

@Module({
  imports: [UsersModule, TwoFactorModule],
  providers: [MembershipTierService],
  controllers: [MembershipTierController],
  exports: [MembershipTierService],
})
export class MembershipTierModule {}
