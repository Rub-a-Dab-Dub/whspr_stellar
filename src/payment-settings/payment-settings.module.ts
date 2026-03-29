import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { CurrencyPreference } from './entities/currency-preference.entity';
import { CurrencyPreferenceRepository } from './repositories/currency-preference.repository';
import { CurrencyConversionService } from './services/currency-conversion.service';
import { CurrencyController } from './controllers/currency.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CurrencyPreference]),
    HttpModule,
    CacheModule.register(),
    ScheduleModule.forRoot(),
    ConfigModule,
  ],
  providers: [CurrencyConversionService, CurrencyPreferenceRepository],
  controllers: [CurrencyController],
  exports: [CurrencyConversionService, CurrencyPreferenceRepository],
})
export class PaymentSettingsModule {}
