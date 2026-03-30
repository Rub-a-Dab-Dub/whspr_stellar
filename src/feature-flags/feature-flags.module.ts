import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CacheModule } from '../cache/cache.module';
import { FeatureFlag } from './entities/feature-flag.entity';
import { FeatureFlagsCacheListener } from './feature-flags-cache.listener';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsEvents } from './feature-flags.events';
import { FeatureFlagsRepository } from './feature-flags.repository';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagGuard } from './guards/feature-flag.guard';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlag]), CacheModule],
  controllers: [FeatureFlagsController],
  providers: [
    FeatureFlagsRepository,
    FeatureFlagsService,
    FeatureFlagsEvents,
    FeatureFlagsCacheListener,
    FeatureFlagGuard,
    JwtAuthGuard,
    AdminGuard,
  ],
  exports: [FeatureFlagsService, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
