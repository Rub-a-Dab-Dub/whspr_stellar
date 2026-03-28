import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { KYCRecord } from './entities/kyc-record.entity';
import { KycProviderService } from './services/kyc-provider/kyc-provider.service';
import { KycWebhookService } from './services/kyc-webhook/kyc-webhook.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([KYCRecord]),
  ],
  controllers: [KycController],
  providers: [
    KycService,
    KycProviderService,
    KycWebhookService,
  ],
  exports: [
    KycService,
  ],
})
export class KycModule {}