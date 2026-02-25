# Cache Module

Redis-backed caching with typed methods, TTL management, tag-based invalidation, and graceful degradation.

## Usage

```typescript
// Inject CacheService
constructor(private cacheService: CacheService) {}

// Basic operations
await cacheService.set('key', { data: 'value' }, 60); // 60s TTL
const value = await cacheService.get('key');
await cacheService.del('key');
await cacheService.delByPrefix('user:');

// Tag-based invalidation
await cacheService.setWithTags('post:1', post, ['posts', 'user:1'], 300);
await cacheService.invalidateByTag('posts');
```

## Decorators

```typescript
@Cacheable('user', 300)
async findUser(id: string) {
  return this.userRepo.findOne(id);
}

@CacheEvict('user')
async updateUser(id: string, data: any) {
  return this.userRepo.update(id, data);
}
```

## Metrics

GET /metrics returns cache hit/miss stats.
