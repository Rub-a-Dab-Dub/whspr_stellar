import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { Referral } from './entities/referral.entity';
import { ReferralsRepository } from './repositories/referrals.repository';
import { ReferralsService } from './services/referrals.service';
import { ReferralsController } from './controllers/referrals.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Referral]),
    CacheModule.register(),
    UsersModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsRepository, ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
