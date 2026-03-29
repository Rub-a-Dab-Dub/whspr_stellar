import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { WalletsRepository } from './wallets.repository';
import { HorizonService } from './services/horizon.service';
import { Wallet } from './entities/wallet.entity';
import { AuthModule } from '../auth/auth.module';
import { TwoFactorModule } from '../two-factor/two-factor.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // In-memory cache by default; swap store for Redis in production:
        // store: require('cache-manager-ioredis'),
        // host: config.get('REDIS_HOST'),
        // port: config.get('REDIS_PORT'),
        ttl: 30_000,
      }),
    }),
    AuthModule,
    TwoFactorModule,
  ],
  controllers: [WalletsController],
  providers: [WalletsService, WalletsRepository, HorizonService],
  exports: [WalletsService, HorizonService],
})
export class WalletsModule {}
