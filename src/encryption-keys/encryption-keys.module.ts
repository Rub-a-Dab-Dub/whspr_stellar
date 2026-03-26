import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncryptionKeysController } from './encryption-keys.controller';
import { EncryptionKeysService } from './encryption-keys.service';
import { EncryptionKeysRepository } from './encryption-keys.repository';
import { PreKeyBundlesRepository } from './pre-key-bundles.repository';
import { SorobanKeyRegistryService } from './soroban-key-registry.service';
import { EncryptionKey } from './entities/encryption-key.entity';
import { PreKeyBundle } from './entities/pre-key-bundle.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EncryptionKey, PreKeyBundle]),
    AuthModule,
  ],
  controllers: [EncryptionKeysController],
  providers: [
    EncryptionKeysService,
    EncryptionKeysRepository,
    PreKeyBundlesRepository,
    SorobanKeyRegistryService,
  ],
  exports: [EncryptionKeysService],
})
export class EncryptionKeysModule {}
