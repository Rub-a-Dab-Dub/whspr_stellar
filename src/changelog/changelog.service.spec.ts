import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ChangelogService } from './changelog.service';
import { Changelog, ChangelogType, ChangelogPlatform } from './entities/changelog.entity';
import { UserChangelogView } from './entities/user-changelog-view.entity';
import { NotificationIntegrationService } from '../notifications/services/notification-integration.service';

const makeRepo = () => ({
  create: jest.fn((e) => e),
  save: jest.fn((e) => Promise.resolve({ id: 'uuid-1', ...e })),
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('ChangelogService', () => {
  let service: ChangelogService;
  let changelogRepo: ReturnType<typeof makeRepo>;
  let viewRepo: ReturnType<typeof makeRepo>;
  let dataSource: { query: jest.Mock };
  let notificationService: { bulkNotify: jest.Mock };

  beforeEach(async () => {
    changelogRepo = makeRepo();
    viewRepo = makeRepo();
    dataSource = { query: jest.fn() };
    notificationService = { bulkNotify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangelogService,
        { provide: getRepositoryToken(Changelog), useValue: changelogRepo },
        { provide: getRepositoryToken(UserChangelogView), useValue: viewRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: NotificationIntegrationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get(ChangelogService);
  });

  it('should create a changelog entry', async () => {
    const dto = {
      version: '1.0.0',
      platform: ChangelogPlatform.ALL,
      title: 'New features',
      highlights: ['highlight one'],
      type: ChangelogType.FEATURE,
    };
    const result = await service.createChangelog(dto);
    expect(changelogRepo.create).toHaveBeenCalled();
    expect(changelogRepo.save).toHaveBeenCalled();
    expect(result.version).toBe('1.0.0');
  });

  it('should update a changelog entry', async () => {
    changelogRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      version: '1.0.0',
      title: 'old',
    });
    const result = await service.updateChangelog('uuid-1', {
      title: 'new title',
    });
    expect(result.title).toBe('new title');
  });

  it('should throw when updating non-existent entry', async () => {
    changelogRepo.findOne.mockResolvedValue(null);
    await expect(
      service.updateChangelog('bad-id', { title: 'x' }),
    ).rejects.toThrow('not found');
  });

  it('should publish and NOT notify for BUGFIX', async () => {
    changelogRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      type: ChangelogType.BUGFIX,
    });
    await service.publishChangelog('uuid-1');
    expect(notificationService.bulkNotify).not.toHaveBeenCalled();
  });

  it('should publish and notify for FEATURE', async () => {
    changelogRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      type: ChangelogType.FEATURE,
      version: '2.0.0',
      title: 'Feature',
      platform: ChangelogPlatform.ALL,
    });
    changelogRepo.save.mockImplementation((e) =>
      Promise.resolve({ ...e, publishedAt: new Date() }),
    );
    dataSource.query.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);

    await service.publishChangelog('uuid-1');
    expect(notificationService.bulkNotify).toHaveBeenCalledTimes(1);
  });

  it('should publish and notify for BREAKING', async () => {
    changelogRepo.findOne.mockResolvedValue({
      id: 'uuid-1',
      type: ChangelogType.BREAKING,
      version: '3.0.0',
      title: 'Breaking',
      platform: ChangelogPlatform.WEB,
    });
    changelogRepo.save.mockImplementation((e) =>
      Promise.resolve({ ...e, publishedAt: new Date() }),
    );
    dataSource.query.mockResolvedValue([{ id: 'u1' }]);

    await service.publishChangelog('uuid-1');
    expect(notificationService.bulkNotify).toHaveBeenCalledTimes(1);
    const callArgs = notificationService.bulkNotify.mock.calls[0];
    expect(callArgs[2]).toContain('Breaking');
  });

  it('should return changelog history paginated', async () => {
    changelogRepo.findAndCount.mockResolvedValue([[{ id: 'uuid-1' }], 1]);
    const result = await service.getChangelogHistory(1, 10);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('should return latest changelog', async () => {
    changelogRepo.findOne.mockResolvedValue({ id: 'uuid-1' });
    const result = await service.getLatestChangelog();
    expect(result.id).toBe('uuid-1');
  });

  it('should mark changelog as seen', async () => {
    viewRepo.findOne.mockResolvedValue(null);
    await service.markSeen('user-1', { version: '1.0.0' });
    expect(viewRepo.create).toHaveBeenCalled();
    expect(viewRepo.save).toHaveBeenCalled();
  });

  it('should update existing view on markSeen', async () => {
    viewRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      lastSeenVersion: '0.9.0',
    });
    await service.markSeen('user-1', { version: '1.0.0' });
    expect(viewRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ lastSeenVersion: '1.0.0' }),
    );
  });

  it('should get unseen count', async () => {
    viewRepo.findOne.mockResolvedValue(null);
    changelogRepo.find.mockResolvedValue([{ id: '1' }, { id: '2' }]);
    const count = await service.getUnseenCount('user-1');
    expect(count).toBe(2);
  });
});
