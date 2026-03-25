import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { EncryptionKeysRepository } from './encryption-keys.repository';
import { PreKeyBundlesRepository } from './pre-key-bundles.repository';
import { SorobanKeyRegistryService } from './soroban-key-registry.service';
import { RegisterKeyDto } from './dto/register-key.dto';
import { RotateKeyDto } from './dto/rotate-key.dto';
import { EncryptionKeyResponseDto } from './dto/encryption-key-response.dto';
import { PreKeyBundleResponseDto } from './dto/pre-key-bundle-response.dto';
import { EncryptionKey } from './entities/encryption-key.entity';
import { PreKeyBundle } from './entities/pre-key-bundle.entity';

@Injectable()
export class EncryptionKeysService {
  private readonly logger = new Logger(EncryptionKeysService.name);

  constructor(
    private readonly encryptionKeysRepository: EncryptionKeysRepository,
    private readonly preKeyBundlesRepository: PreKeyBundlesRepository,
    private readonly sorobanKeyRegistry: SorobanKeyRegistryService,
  ) {}

  async registerKey(userId: string, dto: RegisterKeyDto): Promise<EncryptionKeyResponseDto> {
    const existing = await this.encryptionKeysRepository.findActiveByUserId(userId);
    if (existing) {
      throw new ConflictException(
        'An active encryption key already exists for this user. Use rotate to update it.',
      );
    }

    const key = this.encryptionKeysRepository.create({
      userId,
      publicKey: dto.publicKey,
      keyType: dto.keyType,
      version: 1,
      isActive: true,
      registeredOnChain: false,
    });

    const saved = await this.encryptionKeysRepository.save(key);
    this.logger.log(`Encryption key registered for user ${userId} (v${saved.version})`);

    if (dto.preKeys?.length) {
      await this.savePreKeyBundle(userId, saved.id, dto.preKeys);
    }

    this.syncToChainBackground(saved);

    return this.toDto(saved);
  }

  async rotateKey(userId: string, dto: RotateKeyDto): Promise<EncryptionKeyResponseDto> {
    const activeKey = await this.encryptionKeysRepository.findActiveByUserId(userId);
    if (!activeKey) {
      throw new NotFoundException('No active encryption key found. Register a key first.');
    }

    const nextVersion = await this.encryptionKeysRepository.findNextVersion(userId);

    const newKey = this.encryptionKeysRepository.create({
      userId,
      publicKey: dto.publicKey,
      keyType: dto.keyType,
      version: nextVersion,
      isActive: false,
      registeredOnChain: false,
    });

    const saved = await this.encryptionKeysRepository.save(newKey);

    await this.encryptionKeysRepository.rotateKeys(userId, saved.id);
    await this.preKeyBundlesRepository.invalidateByUserId(userId);

    if (dto.preKeys?.length) {
      await this.savePreKeyBundle(userId, saved.id, dto.preKeys);
    }

    const activated = await this.encryptionKeysRepository.findByUserAndId(userId, saved.id);
    this.logger.log(`Encryption key rotated for user ${userId}: v${activeKey.version} → v${nextVersion}`);

    this.syncToChainBackground(activated!);

    return this.toDto(activated!);
  }

  async getActiveKey(userId: string): Promise<EncryptionKeyResponseDto> {
    const key = await this.encryptionKeysRepository.findActiveByUserId(userId);
    if (!key) {
      throw new NotFoundException('No active encryption key found for this user.');
    }
    return this.toDto(key);
  }

  async getKeyHistory(userId: string): Promise<EncryptionKeyResponseDto[]> {
    const keys = await this.encryptionKeysRepository.findByUserId(userId);
    return keys.map((k) => this.toDto(k));
  }

  async revokeKey(userId: string): Promise<void> {
    const key = await this.encryptionKeysRepository.findActiveByUserId(userId);
    if (!key) {
      throw new NotFoundException('No active encryption key found to revoke.');
    }

    key.isActive = false;
    await this.encryptionKeysRepository.save(key);
    await this.preKeyBundlesRepository.invalidateByUserId(userId);

    this.logger.log(`Encryption key revoked for user ${userId} (v${key.version})`);

    void this.sorobanKeyRegistry.revokeKey(userId, key.publicKey).catch((err) =>
      this.logger.error(`On-chain revocation failed for user ${userId}: ${(err as Error).message}`),
    );
  }

  async syncToChain(keyId: string): Promise<void> {
    const key = await this.encryptionKeysRepository.findOne({ where: { id: keyId } });
    if (!key) {
      throw new NotFoundException(`Encryption key ${keyId} not found.`);
    }

    if (key.registeredOnChain) {
      this.logger.log(`Key ${keyId} already synced to chain`);
      return;
    }

    const success = await this.sorobanKeyRegistry.registerKey(key);
    if (success) {
      key.registeredOnChain = true;
      await this.encryptionKeysRepository.save(key);
      this.logger.log(`Key ${keyId} synced to chain`);
    } else {
      this.logger.warn(`Key ${keyId} chain sync failed — will remain pending`);
    }
  }

  async getPreKeyBundle(userId: string): Promise<PreKeyBundleResponseDto> {
    const bundle = await this.preKeyBundlesRepository.findValidByUserId(userId);
    if (!bundle) {
      throw new NotFoundException('No valid prekey bundle found for this user.');
    }
    return this.toBundleDto(bundle);
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private async savePreKeyBundle(
    userId: string,
    encryptionKeyId: string,
    preKeys: { keyId: number; publicKey: string }[],
  ): Promise<void> {
    const bundle = this.preKeyBundlesRepository.create({
      userId,
      encryptionKeyId,
      preKeys,
      isValid: true,
    });
    await this.preKeyBundlesRepository.save(bundle);
  }

  private syncToChainBackground(key: EncryptionKey): void {
    void this.syncToChain(key.id).catch((err) =>
      this.logger.error(
        `Background chain sync failed for key ${key.id}: ${(err as Error).message}`,
      ),
    );
  }

  private toDto(key: EncryptionKey): EncryptionKeyResponseDto {
    return plainToInstance(EncryptionKeyResponseDto, key, { excludeExtraneousValues: true });
  }

  private toBundleDto(bundle: PreKeyBundle): PreKeyBundleResponseDto {
    return plainToInstance(PreKeyBundleResponseDto, bundle, { excludeExtraneousValues: true });
  }
}
