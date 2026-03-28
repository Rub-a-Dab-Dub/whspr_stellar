import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminSettingsService } from './admin-settings.service';
import { SystemSetting } from '../entities/system-setting.entity';
import { Repository } from 'typeorm';

describe('AdminSettingsService', () => {
  let service: AdminSettingsService;
  let repo: Repository<SystemSetting>;

  const mockSettings = [
    { key: 'TEST_KEY', value: 'TEST_VAL', description: 'desc' },
  ];

  const mockRepo = {
    find: jest.fn().mockResolvedValue(mockSettings),
    findOne: jest.fn().mockImplementation(({ where: { key } }) => {
      if (key === 'TEST_KEY') return Promise.resolve(mockSettings[0]);
      return Promise.resolve(null);
    }),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((setting) => Promise.resolve(setting)),
    remove: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSettingsService,
        {
          provide: getRepositoryToken(SystemSetting),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AdminSettingsService>(AdminSettingsService);
    repo = module.get<Repository<SystemSetting>>(getRepositoryToken(SystemSetting));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create setting', async () => {
    const result = await service.createOrUpdate({ key: 'NEW_KEY', value: '1' });
    expect(repo.save).toHaveBeenCalled();
  });
});
