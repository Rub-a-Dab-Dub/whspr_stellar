import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../cache/cache.service';
import { AppVersionRepository } from './app-version.repository';
import { AppVersionService } from './app-version.service';
import { AppPlatform, AppVersion } from './entities/app-version.entity';

describe('AppVersionService', () => {
  let service: AppVersionService;
  let repository: jest.Mocked<AppVersionRepository>;
  let cache: jest.Mocked<CacheService>;

  const latestVersion: AppVersion = {
    id: 'version-1',
    platform: AppPlatform.WEB,
    version: '2.0.0',
    minSupportedVersion: '1.5.0',
    releaseNotes: 'New dashboard',
    isForceUpdate: false,
    isSoftUpdate: true,
    publishedAt: new Date('2026-03-28T10:00:00.000Z'),
    isDeprecated: false,
    createdAt: new Date('2026-03-28T10:00:00.000Z'),
    updatedAt: new Date('2026-03-28T10:00:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppVersionService,
        {
          provide: AppVersionRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findById: jest.fn(),
            findLatestPublished: jest.fn(),
            findHistory: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            getOrSet: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AppVersionService);
    repository = module.get(AppVersionRepository);
    cache = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('publishes a new version and invalidates the cache', async () => {
    repository.create.mockReturnValue({
      ...latestVersion,
      version: '2.1.0',
      minSupportedVersion: '2.0.0',
    });
    repository.save.mockResolvedValue({
      ...latestVersion,
      version: '2.1.0',
      minSupportedVersion: '2.0.0',
    });
    cache.del.mockResolvedValue();

    const result = await service.publishVersion({
      platform: AppPlatform.WEB,
      version: '2.1.0',
      minSupportedVersion: '2.0.0',
      releaseNotes: 'More stability',
      isSoftUpdate: true,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: AppPlatform.WEB,
        version: '2.1.0',
        minSupportedVersion: '2.0.0',
        isSoftUpdate: true,
      }),
    );
    expect(cache.del).toHaveBeenCalledWith('app_version:latest:WEB');
    expect(result.version).toBe('2.1.0');
  });

  it('returns a soft update warning for supported outdated versions', async () => {
    cache.getOrSet.mockResolvedValue(latestVersion);

    const result = await service.checkCompatibility(AppPlatform.WEB, '1.8.0');

    expect(cache.getOrSet).toHaveBeenCalledWith(
      'app_version:latest:WEB',
      60,
      expect.any(Function),
    );
    expect(result).toMatchObject({
      updateAvailable: true,
      isSupported: true,
      softUpdate: true,
      forceUpdate: false,
    });
  });

  it('returns a force update for unsupported versions', async () => {
    cache.getOrSet.mockResolvedValue({
      ...latestVersion,
      isForceUpdate: true,
      minSupportedVersion: '1.9.0',
    });

    const result = await service.checkCompatibility(AppPlatform.WEB, '1.8.0');

    expect(result).toMatchObject({
      updateAvailable: true,
      isSupported: false,
      forceUpdate: true,
      softUpdate: false,
    });
  });

  it('deprecates a version through updateVersion', async () => {
    repository.findById.mockResolvedValue(latestVersion);
    repository.save.mockImplementation(async (entity) => entity);
    cache.del.mockResolvedValue();

    const result = await service.deprecateVersion(latestVersion.id);

    expect(repository.findById).toHaveBeenCalledWith(latestVersion.id);
    expect(result.isDeprecated).toBe(true);
  });

  it('rejects invalid version strings', async () => {
    await expect(
      service.publishVersion({
        platform: AppPlatform.IOS,
        version: '2.x',
        minSupportedVersion: '2.0.0',
      }),
    ).rejects.toThrow('Invalid version format: 2.x');
  });
});
