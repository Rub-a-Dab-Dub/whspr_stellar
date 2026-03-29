import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { AppVersionRepository } from './app-version.repository';
import { CreateAppVersionDto } from './dto/create-app-version.dto';
import {
  AppVersionResponseDto,
  VersionCompatibilityResponseDto,
} from './dto/app-version-response.dto';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';
import { AppPlatform, AppVersion } from './entities/app-version.entity';

const LATEST_VERSION_CACHE_TTL_SECONDS = 60;

interface ParsedVersion {
  raw: string;
  segments: number[];
}

@Injectable()
export class AppVersionService {
  constructor(
    private readonly repository: AppVersionRepository,
    private readonly cache: CacheService,
  ) {}

  async publishVersion(dto: CreateAppVersionDto): Promise<AppVersionResponseDto> {
    this.validateVersionRelationship(dto.version, dto.minSupportedVersion);
    this.validateUpdateFlags(dto.isForceUpdate ?? false, dto.isSoftUpdate ?? false);

    const entity = this.repository.create({
      platform: dto.platform,
      version: this.normalizeVersion(dto.version),
      minSupportedVersion: this.normalizeVersion(dto.minSupportedVersion),
      releaseNotes: dto.releaseNotes ?? null,
      isForceUpdate: dto.isForceUpdate ?? false,
      isSoftUpdate: dto.isSoftUpdate ?? false,
      publishedAt: dto.publishedAt ?? new Date(),
      isDeprecated: false,
    });

    const saved = await this.repository.save(entity);
    await this.invalidateLatestVersionCache(saved.platform);

    return this.toResponseDto(saved);
  }

  async getLatestVersion(platform: AppPlatform): Promise<AppVersionResponseDto> {
    const entity = await this.getLatestEntity(platform);
    if (!entity) {
      throw new NotFoundException(`No published app version found for platform ${platform}`);
    }

    return this.toResponseDto(entity);
  }

  async checkCompatibility(
    platform: AppPlatform,
    currentVersion: string,
  ): Promise<VersionCompatibilityResponseDto | null> {
    const latest = await this.getLatestEntity(platform);
    if (!latest) {
      return null;
    }

    const normalizedCurrent = this.normalizeVersion(currentVersion);
    const updateAvailable = this.compareVersions(normalizedCurrent, latest.version) < 0;
    const isSupported = this.compareVersions(normalizedCurrent, latest.minSupportedVersion) >= 0;
    const forceUpdate = !isSupported || (updateAvailable && latest.isForceUpdate);
    const softUpdate = isSupported && updateAvailable && latest.isSoftUpdate;

    return {
      platform,
      currentVersion: normalizedCurrent,
      latestVersion: latest.version,
      minSupportedVersion: latest.minSupportedVersion,
      releaseNotes: latest.releaseNotes,
      updateAvailable,
      forceUpdate,
      softUpdate,
      isSupported,
    };
  }

  async getVersionHistory(platform?: AppPlatform): Promise<AppVersionResponseDto[]> {
    const history = await this.repository.findHistory(
      platform ? { platform } : {},
    );
    return history.map((item) => this.toResponseDto(item));
  }

  async updateVersion(id: string, dto: UpdateAppVersionDto): Promise<AppVersionResponseDto> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(`App version ${id} was not found`);
    }

    const nextVersion = dto.version ? this.normalizeVersion(dto.version) : entity.version;
    const nextMinSupportedVersion = dto.minSupportedVersion
      ? this.normalizeVersion(dto.minSupportedVersion)
      : entity.minSupportedVersion;

    this.validateVersionRelationship(nextVersion, nextMinSupportedVersion);
    this.validateUpdateFlags(
      dto.isForceUpdate ?? entity.isForceUpdate,
      dto.isSoftUpdate ?? entity.isSoftUpdate,
    );

    Object.assign(entity, {
      ...(dto.platform ? { platform: dto.platform } : {}),
      ...(dto.version ? { version: nextVersion } : {}),
      ...(dto.minSupportedVersion ? { minSupportedVersion: nextMinSupportedVersion } : {}),
      ...(dto.releaseNotes !== undefined ? { releaseNotes: dto.releaseNotes } : {}),
      ...(dto.isForceUpdate !== undefined ? { isForceUpdate: dto.isForceUpdate } : {}),
      ...(dto.isSoftUpdate !== undefined ? { isSoftUpdate: dto.isSoftUpdate } : {}),
      ...(dto.publishedAt ? { publishedAt: dto.publishedAt } : {}),
      ...(dto.isDeprecated !== undefined ? { isDeprecated: dto.isDeprecated } : {}),
    });

    const saved = await this.repository.save(entity);
    await this.invalidateLatestVersionCache(entity.platform);

    return this.toResponseDto(saved);
  }

  async deprecateVersion(id: string): Promise<AppVersionResponseDto> {
    return this.updateVersion(id, { isDeprecated: true });
  }

  private async getLatestEntity(platform: AppPlatform): Promise<AppVersion | null> {
    const entity = await this.cache.getOrSet<AppVersion | null>(
      this.latestVersionCacheKey(platform),
      LATEST_VERSION_CACHE_TTL_SECONDS,
      () => this.repository.findLatestPublished(platform),
    );

    return entity ? this.hydrateEntity(entity) : null;
  }

  private async invalidateLatestVersionCache(platform: AppPlatform): Promise<void> {
    await this.cache.del(this.latestVersionCacheKey(platform));
  }

  private latestVersionCacheKey(platform: AppPlatform): string {
    return `app_version:latest:${platform}`;
  }

  private toResponseDto(entity: AppVersion): AppVersionResponseDto {
    const normalized = this.hydrateEntity(entity);
    return {
      id: normalized.id,
      platform: normalized.platform,
      version: normalized.version,
      minSupportedVersion: normalized.minSupportedVersion,
      releaseNotes: normalized.releaseNotes,
      isForceUpdate: normalized.isForceUpdate,
      isSoftUpdate: normalized.isSoftUpdate,
      publishedAt: normalized.publishedAt,
      isDeprecated: normalized.isDeprecated,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
    };
  }

  private hydrateEntity(entity: AppVersion): AppVersion {
    return {
      ...entity,
      publishedAt: new Date(entity.publishedAt),
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }

  private validateUpdateFlags(isForceUpdate: boolean, isSoftUpdate: boolean): void {
    if (isForceUpdate && isSoftUpdate) {
      throw new BadRequestException('A version cannot be both force update and soft update');
    }
  }

  private validateVersionRelationship(version: string, minSupportedVersion: string): void {
    if (this.compareVersions(minSupportedVersion, version) > 0) {
      throw new BadRequestException(
        'minSupportedVersion cannot be greater than the published version',
      );
    }
  }

  private normalizeVersion(version: string): string {
    const trimmed = version.trim().replace(/^v/i, '');
    if (!/^\d+(\.\d+){0,3}$/.test(trimmed)) {
      throw new BadRequestException(`Invalid version format: ${version}`);
    }

    return trimmed;
  }

  private compareVersions(left: string, right: string): number {
    const a = this.parseVersion(left);
    const b = this.parseVersion(right);
    const maxLength = Math.max(a.segments.length, b.segments.length);

    for (let index = 0; index < maxLength; index += 1) {
      const leftValue = a.segments[index] ?? 0;
      const rightValue = b.segments[index] ?? 0;

      if (leftValue > rightValue) return 1;
      if (leftValue < rightValue) return -1;
    }

    return 0;
  }

  private parseVersion(version: string): ParsedVersion {
    const normalized = this.normalizeVersion(version);
    return {
      raw: normalized,
      segments: normalized.split('.').map((segment) => Number(segment)),
    };
  }
}
