import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { WithdrawalRequest } from './withdrawals/entities/withdrawal-request.entity';
import { WithdrawalAuditLog } from './withdrawals/entities/withdrawal-audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASSWORD', 'password'),
        database: config.get('DB_NAME', 'withdrawals_db'),
        entities: [WithdrawalRequest, WithdrawalAuditLog],
        synchronize: config.get('NODE_ENV') !== 'production', // use migrations in prod
        logging: config.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    PassportModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'change-me-in-production'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '1d') },
      }),
      inject: [ConfigService],
    }),

    WithdrawalsModule,
  ],
})
export class AppModule {}
