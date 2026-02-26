import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../user/entities/user.entity';
import { XpTransaction } from './entities/xp-transaction.entity';
import { XpGateway } from './gateways/xp.gateway';
import { UserXpService } from './user-xp.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([XpTransaction, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
      }),
    }),
    AnalyticsModule,
  ],
  providers: [UserXpService, XpGateway],
  exports: [UserXpService],
})
export class XpModule {}
