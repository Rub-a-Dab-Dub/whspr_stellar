// src/admin/admin-api-keys.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { generateAdminApiKey } from 'src/common/utils/api-key.util';
import { AdminApiKey } from '../entities/admin-api-key.entity';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';

interface CreateApiKeyDto {
  name: string;
  permissions?: string[];
  expiresAt?: Date;
}

@Injectable()
export class AdminApiKeysService {
  constructor(
    @InjectRepository(AdminApiKey)
    private readonly repo: Repository<AdminApiKey>,
  ) {}

  async create(dto: CreateApiKeyDto, currentAdmin: User) {
    const { rawKey, hash, prefix } = generateAdminApiKey();

    const key = this.repo.create({
      name: dto.name,
      keyHash: hash,
      keyPrefix: prefix,
      permissions: dto.permissions ?? [],
      expiresAt: dto.expiresAt ?? null,
      isActive: true,
      admin: currentAdmin,
    });

    await this.repo.save(key);

    // Return the raw key only once — it cannot be retrieved again
    return {
      rawKey,
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      permissions: key.permissions,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    };
  }

  async validateKey(rawKey: string): Promise<AdminApiKey | null> {
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex'); // 👈 use imported crypto

    const key = await this.repo.findOne({
      where: {
        keyHash: hash,
        isActive: true,
      },
      relations: ['admin'],
    });

    if (!key) return null;

    if (key.expiresAt && key.expiresAt < new Date()) return null;

    key.lastUsedAt = new Date();
    await this.repo.save(key);

    return key;
  }

  async listForAdmin(currentAdmin: User) {
    const where =
      currentAdmin.role === 'super_admin'
        ? {}
        : { admin: { id: currentAdmin.id } };

    const keys = await this.repo.find({
      where,
      relations: ['admin'],
      order: { createdAt: 'DESC' },
    });

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      permissions: key.permissions,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
    }));
  }

  async revoke(id: string, currentAdmin: User) {
    const key = await this.repo.findOne({
      where: { id },
      relations: ['admin'],
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    if (
      key.admin.id !== currentAdmin.id &&
      currentAdmin.role !== 'super_admin'
    ) {
      throw new ForbiddenException("You cannot revoke another admin's API key"); // 👈 fixed smart quote
    }

    key.isActive = false;
    await this.repo.save(key);

    return { message: 'API key revoked successfully' };
  }
}
