import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { QrCodeService } from './qr-code.service';
import { QrCodeController } from './qr-code.controller';

@Module({
  imports: [CacheModule.register({ ttl: 3_600_000 })],
  controllers: [QrCodeController],
  providers: [QrCodeService],
  exports: [QrCodeService],
})
export class QrCodeModule {}
