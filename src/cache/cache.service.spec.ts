import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cache-aside pattern', () => {
    it('should return null on cache miss', async () => {
      const result = await service.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should set and get value', async () => {
      await service.set('test-key', { data: 'value' }, 60);
      const result = await service.get('test-key');
      expect(result).toEqual({ data: 'value' });
    });

    it('should delete key', async () => {
      await service.set('test-key', { data: 'value' });
      await service.del('test-key');
      const result = await service.get('test-key');
      expect(result).toBeNull();
    });

    it('should delete by prefix', async () => {
      await service.set('user:1', { id: 1 });
      await service.set('user:2', { id: 2 });
      await service.delByPrefix('user:');
      
      const result1 = await service.get('user:1');
      const result2 = await service.get('user:2');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('tag-based invalidation', () => {
    it('should associate cache entries with tags', async () => {
      await service.setWithTags('post:1', { title: 'Post 1' }, ['posts', 'user:1'], 60);
      const result = await service.get('post:1');
      expect(result).toEqual({ title: 'Post 1' });
    });

    it('should invalidate all entries by tag', async () => {
      await service.setWithTags('post:1', { title: 'Post 1' }, ['posts']);
      await service.setWithTags('post:2', { title: 'Post 2' }, ['posts']);
      
      await service.invalidateByTag('posts');
      
      const result1 = await service.get('post:1');
      const result2 = await service.get('post:2');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('metrics', () => {
    it('should track cache hits and misses', async () => {
      await service.set('key1', 'value1');
      await service.get('key1'); // hit
      await service.get('nonexistent'); // miss
      
      const metrics = service.getMetrics();
      expect(metrics.hits).toBeGreaterThan(0);
      expect(metrics.misses).toBeGreaterThan(0);
    });
  });

  describe('graceful degradation', () => {
    it('should handle Redis unavailability', async () => {
      const result = await service.get('any-key');
      expect(result).toBeNull();
    });
  });
});
