import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RateLimitGuard } from './rate-limit.guard';

@Module({
  imports: [ConfigModule],
  providers: [RateLimitGuard],
  exports: [RateLimitGuard],
})
export class RateLimitModule {}
