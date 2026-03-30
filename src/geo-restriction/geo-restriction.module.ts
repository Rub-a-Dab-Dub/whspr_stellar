import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GeoRestriction } from './entities/geo-restriction.entity';
import { UserGeoRecord } from './entities/user-geo-record.entity';
import { GeoRestrictionService } from './geo-restriction.service';
import { GeoRestrictionController } from './geo-restriction.controller';
import { GeoRestrictionMiddleware } from './geo-restriction.middleware';
import { GeoFeatureGuard } from './guards/geo-feature.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([GeoRestriction, UserGeoRecord]),
  ],
  controllers: [GeoRestrictionController],
  providers: [GeoRestrictionService, GeoFeatureGuard],
  exports: [GeoRestrictionService, GeoFeatureGuard],
})
export class GeoRestrictionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(GeoRestrictionMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
