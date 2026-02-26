import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppGateway } from './app.gateway';
import { GatewayController } from './gateway.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
    }),
    RedisModule,
  ],
  providers: [AppGateway],
  controllers: [GatewayController],
})
export class GatewayModule {}
