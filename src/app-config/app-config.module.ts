import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AppConfig } from './entities/app-config.entity';
import { AppConfigRepository } from './app-config.repository';
import { AppConfigService } from './app-config.service';
import { AppConfigPublicController } from './app-config-public.controller';
import { AppConfigAdminController } from './app-config-admin.controller';
import { AdminConfigGateway } from './admin-config.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppConfig]),
    AuthModule,
    AuditLogModule,
  ],
  controllers: [AppConfigPublicController, AppConfigAdminController],
  providers: [AppConfigRepository, AppConfigService, AdminConfigGateway],
  exports: [AppConfigService],
})
export class AppConfigModule {}
