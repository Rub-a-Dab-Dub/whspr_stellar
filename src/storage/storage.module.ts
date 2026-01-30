import { Module } from '@nestjs/common';
import { IpfsStorageService } from './services/ipfs-storage.service';
import { ArweaveStorageService } from './services/arweave-storage.service';
import { VirusScanService } from './services/virus-scan.service';
import { ThumbnailService } from './services/thumbnail.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [
    IpfsStorageService,
    ArweaveStorageService,
    VirusScanService,
    ThumbnailService,
  ],
  exports: [
    IpfsStorageService,
    ArweaveStorageService,
    VirusScanService,
    ThumbnailService,
  ],
})
export class StorageModule {}
