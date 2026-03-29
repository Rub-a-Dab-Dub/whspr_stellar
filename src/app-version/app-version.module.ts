import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../cache/cache.module';
import { AppVersionController } from './app-version.controller';
import { AppVersionRepository } from './app-version.repository';
import { AppVersionService } from './app-version.service';
import { AppVersion } from './entities/app-version.entity';
import { VersionCheckMiddleware } from './version-check.middleware';

@Module({
  imports: [TypeOrmModule.forFeature([AppVersion]), AuthModule, CacheModule],
  controllers: [AppVersionController],
  providers: [AppVersionRepository, AppVersionService, VersionCheckMiddleware],
  exports: [AppVersionService],
})
export class AppVersionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(VersionCheckMiddleware)
      .exclude(
        { path: 'health/live', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        { path: 'metrics', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
