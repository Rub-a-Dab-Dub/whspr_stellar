import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';
import { PseudonymModule } from './pseudonym/pseudonym.module';
import { WalletModule } from './wallet/wallet.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AdminModule } from './admin/admin.module';
import { AdminUsersModule } from './admin/user/admin-users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    UserModule,
    PseudonymModule,
    WalletModule,
    AuditLogModule,
    AdminModule,
    AdminUsersModule,
  ],
})
export class AppModule {}
