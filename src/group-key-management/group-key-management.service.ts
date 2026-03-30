import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { GroupEncryptionKey } from './entities/group-encryption-key.entity';
import { MemberKeyBundle } from './entities/member-key-bundle.entity';
import {
  DistributeKeyDto,
  RotateKeyResponseDto,
  KeyVersionResponseDto,
  KeyBundleResponseDto,
} from './dto/group-key.dto';

@Injectable()
export class GroupKeyManagementService {
  private readonly logger = new Logger(GroupKeyManagementService.name);

  constructor(
    @InjectRepository(GroupEncryptionKey)
    private readonly keyRepo: Repository<GroupEncryptionKey>,
    @InjectRepository(MemberKeyBundle)
    private readonly bundleRepo: Repository<MemberKeyBundle>,
  ) {}

  /**
   * Generate a new AES-256 group key for a room/group, deactivating any
   * existing active key and bumping the version.
   */
  async generateGroupKey(groupId: string): Promise<GroupEncryptionKey> {
    const existing = await this.keyRepo.findOne({
      where: { groupId, isActive: true },
    });

    const nextVersion = existing ? existing.keyVersion + 1 : 1;

    if (existing) {
      existing.isActive = false;
      await this.keyRepo.save(existing);
    }

    const keyMaterial = crypto.randomBytes(32).toString('hex');

    const newKey = this.keyRepo.create({
      groupId,
      keyVersion: nextVersion,
      keyMaterial,
      isActive: true,
    });

    return this.keyRepo.save(newKey);
  }

  /**
   * Encrypt the active group key for a specific member using their public key.
   * Falls back to plaintext hex wrapping when no publicKey is provided.
   */
  async distributeToMember(
    groupId: string,
    dto: DistributeKeyDto,
  ): Promise<MemberKeyBundle> {
    const activeKey = await this.getActiveKey(groupId);

    let encryptedGroupKey: string;

    if (dto.publicKey) {
      try {
        const encrypted = crypto.publicEncrypt(
          {
            key: dto.publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
          },
          Buffer.from(activeKey.keyMaterial, 'hex'),
        );
        encryptedGroupKey = encrypted.toString('base64');
      } catch (err) {
        this.logger.warn(
          `RSA encrypt failed for member ${dto.memberId}, falling back to hex wrap`,
        );
        encryptedGroupKey = Buffer.from(activeKey.keyMaterial, 'hex').toString(
          'base64',
        );
      }
    } else {
      encryptedGroupKey = Buffer.from(activeKey.keyMaterial, 'hex').toString(
        'base64',
      );
    }

    const bundle = this.bundleRepo.create({
      groupKey: activeKey,
      memberId: dto.memberId,
      encryptedGroupKey,
      deviceId: dto.deviceId ?? 'default',
    });

    return this.bundleRepo.save(bundle);
  }

  /**
   * Distribute the active key to many members in parallel.
   */
  async distributeToAllMembers(
    groupId: string,
    memberIds: string[],
  ): Promise<void> {
    const promises = memberIds.map((memberId) =>
      this.distributeToMember(groupId, { memberId }).catch((err) => {
        this.logger.error(
          `Failed to distribute key to member ${memberId}: ${err.message}`,
        );
      }),
    );
    await Promise.all(promises);
  }

  /**
   * Rotate the group key: generate new key + distribute to given members.
   */
  async rotateGroupKey(
    groupId: string,
    memberIds: string[],
  ): Promise<RotateKeyResponseDto> {
    const newKey = await this.generateGroupKey(groupId);
    await this.distributeToAllMembers(groupId, memberIds);
    return {
      groupId,
      newKeyVersion: newKey.keyVersion,
      distributedTo: memberIds.length,
    };
  }

  /**
   * Get the encrypted key bundle for a specific member.
   */
  async getMemberKeyBundle(
    groupId: string,
    memberId: string,
  ): Promise<KeyBundleResponseDto> {
    const activeKey = await this.getActiveKey(groupId);

    const bundle = await this.bundleRepo.findOne({
      where: { groupKey: { id: activeKey.id }, memberId },
      order: { createdAt: 'DESC' },
    });

    if (!bundle) {
      throw new NotFoundException(
        `No key bundle found for member ${memberId} in group ${groupId}`,
      );
    }

    return {
      groupId,
      memberId,
      keyVersion: activeKey.keyVersion,
      encryptedGroupKey: bundle.encryptedGroupKey,
      deviceId: bundle.deviceId,
    };
  }

  /**
   * Revoke a member's key bundles when they leave / get kicked / banned.
   */
  async revokeOnMemberLeave(
    groupId: string,
    memberId: string,
  ): Promise<void> {
    const activeKey = await this.keyRepo.findOne({
      where: { groupId, isActive: true },
    });
    if (!activeKey) return;

    await this.bundleRepo.delete({
      groupKey: { id: activeKey.id },
      memberId,
    });

    this.logger.log(
      `Revoked key bundles for member ${memberId} in group ${groupId}`,
    );
  }

  /**
   * Get the current active key version number.
   */
  async getActiveKeyVersion(
    groupId: string,
  ): Promise<KeyVersionResponseDto> {
    const key = await this.getActiveKey(groupId);
    return { groupId, keyVersion: key.keyVersion, isActive: key.isActive };
  }

  /**
   * Internal helper: fetch the active key or throw.
   */
  async getActiveKey(groupId: string): Promise<GroupEncryptionKey> {
    const key = await this.keyRepo.findOne({
      where: { groupId, isActive: true },
    });
    if (!key) {
      throw new NotFoundException(
        `No active encryption key for group ${groupId}`,
      );
    }
    return key;
  }
}
