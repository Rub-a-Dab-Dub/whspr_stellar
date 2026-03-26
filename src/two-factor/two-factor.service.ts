import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomInt,
  scryptSync,
} from 'crypto';
import { authenticator } from 'otplib';
import { Repository } from 'typeorm';
import { TranslationService } from '../i18n/services/translation.service';
import { UsersService } from '../users/users.service';
import {
  BACKUP_CODE_COUNT,
  BACKUP_CODE_LENGTH,
  TOTP_ISSUER,
} from './constants';
import { TwoFactorSecret } from './entities/two-factor-secret.entity';
import { TwoFactorEnableResponseDto } from './dto/two-factor-enable-response.dto';
import { TwoFactorSetupResponseDto } from './dto/two-factor-setup-response.dto';

authenticator.options = { window: 1 };

const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BCRYPT_ROUNDS = 10;

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectRepository(TwoFactorSecret)
    private readonly repo: Repository<TwoFactorSecret>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly translationService: TranslationService,
  ) {}

  async isEnabled(userId: string): Promise<boolean> {
    const row = await this.repo.findOne({ where: { userId } });
    return row?.isEnabled === true;
  }

  async setup(userId: string): Promise<TwoFactorSetupResponseDto> {
    const existing = await this.repo.findOne({ where: { userId } });
    if (existing?.isEnabled) {
      throw new ConflictException(
        this.translationService.translate('errors.twoFactor.alreadyEnabled'),
      );
    }

    const user = await this.usersService.findById(userId);
    const plainSecret = authenticator.generateSecret();

    const secretEncrypted = this.encryptSecret(plainSecret);

    if (existing && !existing.isEnabled) {
      existing.secretEncrypted = secretEncrypted;
      existing.backupCodeHashes = [];
      existing.enabledAt = null;
      await this.repo.save(existing);
    } else {
      await this.repo.save(
        this.repo.create({
          userId,
          secretEncrypted,
          backupCodeHashes: [],
          isEnabled: false,
          enabledAt: null,
        }),
      );
    }

    const otpauthUrl = authenticator.keyuri(user.walletAddress, TOTP_ISSUER, plainSecret);

    return { otpauthUrl, manualEntryKey: plainSecret };
  }

  async enable(userId: string, code: string): Promise<TwoFactorEnableResponseDto> {
    const row = await this.requirePendingRow(userId);
    const plainSecret = this.decryptSecret(row.secretEncrypted);

    if (!this.verifyTotp(plainSecret, code)) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.twoFactor.invalidCode'),
      );
    }

    const backupCodes = this.generatePlainBackupCodes();
    const backupCodeHashes = await this.hashBackupCodes(backupCodes);

    row.isEnabled = true;
    row.enabledAt = new Date();
    row.backupCodeHashes = backupCodeHashes;
    await this.repo.save(row);

    return { backupCodes };
  }

  async disable(userId: string, code: string): Promise<void> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row?.isEnabled) {
      throw new NotFoundException(
        this.translationService.translate('errors.twoFactor.notEnabled'),
      );
    }

    const ok = await this.validateTotpOrRedeemBackup(row, code);
    if (!ok) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.twoFactor.invalidCode'),
      );
    }

    await this.repo.delete({ userId });
  }

  async assertValidLoginCode(userId: string, code: string): Promise<void> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row?.isEnabled) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.twoFactor.notEnabled'),
      );
    }

    const ok = await this.validateTotpOrRedeemBackup(row, code);
    if (!ok) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.twoFactor.invalidCode'),
      );
    }
  }

  async getBackupCodesMeta(userId: string): Promise<{ remaining: number }> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row?.isEnabled) {
      throw new NotFoundException(
        this.translationService.translate('errors.twoFactor.notEnabled'),
      );
    }
    return { remaining: row.backupCodeHashes.length };
  }

  async regenerateBackupCodes(userId: string): Promise<{ backupCodes: string[] }> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row?.isEnabled) {
      throw new NotFoundException(
        this.translationService.translate('errors.twoFactor.notEnabled'),
      );
    }

    const backupCodes = this.generatePlainBackupCodes();
    row.backupCodeHashes = await this.hashBackupCodes(backupCodes);
    await this.repo.save(row);

    return { backupCodes };
  }

  async removeAllForUser(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  async validateSensitiveActionCode(userId: string, rawCode: string): Promise<void> {
    if (!(await this.isEnabled(userId))) {
      return;
    }

    const normalized = this.normalizeCode(rawCode);
    if (!normalized) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.twoFactor.codeRequired'),
      );
    }

    const row = await this.repo.findOne({ where: { userId } });
    if (!row?.isEnabled) {
      return;
    }

    const ok = await this.validateTotpOrRedeemBackup(row, normalized);
    if (!ok) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.twoFactor.invalidCode'),
      );
    }
  }

  private async requirePendingRow(userId: string): Promise<TwoFactorSecret> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row) {
      throw new NotFoundException(
        this.translationService.translate('errors.twoFactor.setupRequired'),
      );
    }
    if (row.isEnabled) {
      throw new ConflictException(
        this.translationService.translate('errors.twoFactor.alreadyEnabled'),
      );
    }
    return row;
  }

  private verifyTotp(secretPlain: string, code: string): boolean {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      return false;
    }
    return authenticator.check(trimmed, secretPlain);
  }

  private async validateTotpOrRedeemBackup(row: TwoFactorSecret, code: string): Promise<boolean> {
    const plainSecret = this.decryptSecret(row.secretEncrypted);
    if (this.verifyTotp(plainSecret, code)) {
      return true;
    }

    const normalizedBackup = this.normalizeBackupCode(code);
    if (!normalizedBackup) {
      return false;
    }

    return this.redeemBackupCode(row, normalizedBackup);
  }

  private normalizeCode(raw: string): string {
    return raw?.trim() ?? '';
  }

  private normalizeBackupCode(code: string): string | null {
    const compact = code.replace(/\s+/gu, '').toUpperCase();
    if (compact.length < 6 || compact.length > BACKUP_CODE_LENGTH) {
      return null;
    }
    return compact;
  }

  private async redeemBackupCode(row: TwoFactorSecret, code: string): Promise<boolean> {
    const remaining: string[] = [];
    let matched = false;

    for (const hash of row.backupCodeHashes) {
      if (!matched) {
        const isMatch = await bcrypt.compare(code, hash);
        if (isMatch) {
          matched = true;
          continue;
        }
      }
      remaining.push(hash);
    }

    if (!matched) {
      return false;
    }

    row.backupCodeHashes = remaining;
    await this.repo.save(row);
    return true;
  }

  private generatePlainBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i += 1) {
      let chunk = '';
      for (let j = 0; j < BACKUP_CODE_LENGTH; j += 1) {
        chunk += BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)];
      }
      codes.push(chunk);
    }
    return codes;
  }

  private async hashBackupCodes(codes: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const c of codes) {
      out.push(await bcrypt.hash(c, BCRYPT_ROUNDS));
    }
    return out;
  }

  private encryptSecret(plain: string): string {
    const key = this.deriveKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('base64url'),
      tag.toString('base64url'),
      enc.toString('base64url'),
    ].join('.');
  }

  private decryptSecret(payload: string): string {
    const key = this.deriveKey();
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.twoFactor.invalidCode'),
      );
    }
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  private deriveKey(): Buffer {
    const secret = this.configService.get<string>('JWT_SECRET');
    return scryptSync(secret, 'gasless-gossip-2fa-v1', 32);
  }
}
