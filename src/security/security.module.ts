import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IpBlockService } from './ip-block.service';
import { IpBlockGuard } from './ip-block.guard';
import { AuthThrottleService } from './auth-throttle.service';

@Module({
  imports: [ConfigModule],
  providers: [IpBlockService, IpBlockGuard, AuthThrottleService],
  exports: [IpBlockService, IpBlockGuard, AuthThrottleService],
})
export class SecurityModule {}
