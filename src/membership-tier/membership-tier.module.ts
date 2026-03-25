import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipTierService } from './membership-tier.service';
import { MembershipTierController } from './membership-tier.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [MembershipTierService],
  controllers: [MembershipTierController],
  exports: [MembershipTierService],
})
export class MembershipTierModule {}
