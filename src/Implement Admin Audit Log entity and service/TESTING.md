# Testing Guide for Admin Audit Log Service

This document provides comprehensive guidance on testing the Admin Audit Log Service.

## Running Tests

### Run All Tests

```bash
npm run test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:cov
```

### Run Only a Specific Test File

```bash
npm run test -- admin-audit-log.service.spec.ts
```

### Run Tests Matching a Pattern

```bash
npm run test -- --testNamePattern="log method"
```

## Test Structure

The test suite is organized in `src/admin-audit-log/admin-audit-log.service.spec.ts` and covers:

### 1. Basic Logging (`log` method)

**Test Cases:**

- ✅ Successfully log an admin action
- ✅ Handle errors gracefully without throwing
- ✅ Log with metadata

**Key Assertions:**

- Verifies `repository.create()` is called with correct DTO
- Verifies `repository.save()` is called
- Confirms errors don't propagate (fire-and-forget)

### 2. Finding All Logs (`findAll` method)

**Test Cases:**

- ✅ Return paginated audit logs with default pagination
- ✅ Filter by adminId
- ✅ Filter by action
- ✅ Filter by targetType
- ✅ Filter by date range
- ✅ Apply default pagination when not specified
- ✅ Calculate correct page count

**Coverage:**

- Multiple filters combined
- Edge cases for pagination
- Proper QueryBuilder usage
- All filter combinations

### 3. Finding Logs by Admin ID

**Test Cases:**

- ✅ Find logs by admin ID
- ✅ Support pagination for findByAdminId

### 4. Finding Logs by ID

**Test Cases:**

- ✅ Find a log by ID
- ✅ Return null if log not found

### 5. Counting Actions

**Test Cases:**

- ✅ Count logs by action

### 6. Getting Admin IDs

**Test Cases:**

- ✅ Get distinct admin IDs

### 7. Batch Logging

**Test Cases:**

- ✅ Batch log multiple actions
- ✅ Handle batch logging errors gracefully

## Test Execution Details

### Mock Setup

The tests use Jest's mocking capabilities:

```typescript
const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
  query: jest.fn(),
};
```

### Test Data

Mock admin audit log entry:

```typescript
const mockAdminAuditLog = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  adminId: '550e8400-e29b-41d4-a716-446655440001',
  adminEmail: 'admin@test.com',
  action: AdminAuditLogAction.LOGIN,
  targetType: AuditLogTargetType.SYSTEM,
  targetId: null,
  metadata: null,
  ipAddress: '192.168.1.1',
  createdAt: new Date('2026-02-21'),
};
```

## Testing Integration with Other Services

### Setting Up a Module for Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLogModule } from '@/admin-audit-log';

describe('Integration with Other Services', () => {
  let service: AdminAuditLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AdminAuditLogModule],
    }).compile();

    service = module.get<AdminAuditLogService>(AdminAuditLogService);
  });

  it('should be injected into dependent services', () => {
    expect(service).toBeDefined();
  });
});
```

## E2E Testing Example

For end-to-end testing with a real database:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { AdminAuditLogModule } from '@/admin-audit-log';

describe('Admin Audit Log E2E', () => {
  let app: INestApplication;
  let auditLogService: AdminAuditLogService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'password',
          database: 'admin_audit_log_test',
          entities: ['src/**/*.entity.ts'],
          synchronize: true,
        }),
        AdminAuditLogModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    auditLogService =
      moduleFixture.get<AdminAuditLogService>(AdminAuditLogService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should log and retrieve audit entries', async () => {
    // Log an action
    await auditLogService.log({
      adminId: '550e8400-e29b-41d4-a716-446655440001',
      adminEmail: 'admin@test.com',
      action: AdminAuditLogAction.LOGIN,
      targetType: AuditLogTargetType.SYSTEM,
      ipAddress: '192.168.1.1',
    });

    // Retrieve the log
    const result = await auditLogService.findAll({
      page: 1,
      limit: 20,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].adminEmail).toBe('admin@test.com');
  });
});
```

## Test Coverage Report

After running `npm run test:cov`, a coverage report is generated in the `coverage/` directory.

### Accessing the Report

```bash
# Open coverage report in browser
open coverage/index.html
```

### Coverage Goals

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

## Common Test Patterns

### Testing Error Scenarios

```typescript
it('should handle database errors gracefully', async () => {
  mockRepository.save.mockRejectedValue(
    new Error('Database connection failed'),
  );

  // Should not throw
  await expect(service.log(createDto)).resolves.not.toThrow();
});
```

### Testing with Multiple Filters

```typescript
it('should apply multiple filters correctly', async () => {
  const filters: AdminAuditLogFilterDto = {
    adminId: 'admin-123',
    action: AdminAuditLogAction.BAN_USER,
    targetType: AuditLogTargetType.USER,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    page: 1,
    limit: 50,
  };

  const result = await service.findAll(filters);

  // Verify all filters were applied
  expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(6);
});
```

## Debugging Tests

### Enable Logging During Tests

```typescript
beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AdminAuditLogService,
      {
        provide: getRepositoryToken(AdminAuditLog),
        useValue: mockRepository,
      },
    ],
  })
    .setLogger(new Logger()) // Enable logging
    .compile();
});
```

### Use `console.log` for Debugging

```typescript
it('should log correctly', async () => {
  const createDto: CreateAdminAuditLogDto = {...};

  console.log('CreateDto:', JSON.stringify(createDto, null, 2));

  await service.log(createDto);

  console.log('Mock calls:', mockRepository.create.mock.calls);
});
```

### Run Specific Test in Debug Mode

```bash
node --inspect-brk -r tsconfig-paths/register -r ts-node/register \
  node_modules/.bin/jest --runInBand --testNamePattern="specific test name"
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: admin_audit_log_test

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install
      - run: npm run test:cov

      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Performance Testing

### Testing High-Volume Logging

```typescript
it('should handle high-volume logging efficiently', async () => {
  const logs = Array.from({ length: 1000 }, (_, i) => ({
    adminId: `admin-${i % 10}`,
    adminEmail: `admin${i % 10}@test.com`,
    action: AdminAuditLogAction.LOGIN,
    targetType: AuditLogTargetType.SYSTEM,
  }));

  const startTime = performance.now();
  await service.logBatch(logs);
  const duration = performance.now() - startTime;

  console.log(`Logged 1000 entries in ${duration}ms`);
  expect(duration).toBeLessThan(1000); // Should complete in < 1 second
});
```

### Testing Query Performance

```typescript
it('should query filtered logs efficiently', async () => {
  // Simulate 10,000 existing logs
  mockRepository.createQueryBuilder.mockReturnValue({
    // ... queryBuilder mock setup
  });

  const startTime = performance.now();

  const result = await service.findAll({
    adminId: 'specific-admin',
    action: AdminAuditLogAction.BAN_USER,
    page: 1,
    limit: 50,
  });

  const duration = performance.now() - startTime;
  console.log(`Query executed in ${duration}ms`);
  expect(duration).toBeLessThan(100);
});
```

## Test Maintenance

### Update Tests When Adding Features

When adding new service methods or modifying existing ones:

1. Add test cases for new functionality
2. Update mock expectations
3. Test error scenarios
4. Verify pagination/filtering still works
5. Run full test suite to check for regressions

### Keeping Tests DRY

Use helper functions for common test setup:

```typescript
function createMockAuditLog(overrides?: Partial<AdminAuditLog>): AdminAuditLog {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    adminId: '550e8400-e29b-41d4-a716-446655440001',
    adminEmail: 'admin@test.com',
    action: AdminAuditLogAction.LOGIN,
    targetType: AuditLogTargetType.SYSTEM,
    targetId: null,
    metadata: null,
    ipAddress: '192.168.1.1',
    createdAt: new Date(),
    ...overrides,
  };
}

it('should log actions', async () => {
  const mockLog = createMockAuditLog({
    action: AdminAuditLogAction.BAN_USER,
  });

  // Use mockLog in test
});
```

## Troubleshooting Tests

### Common Issues

**Issue**: Tests pass locally but fail in CI

- **Solution**: Ensure all dependencies are versioned in package.json
- **Solution**: Check for hardcoded timestamps or timezone issues

**Issue**: Tests timeout

- **Solution**: Increase timeout: `jest.setTimeout(10000)`
- **Solution**: Check for unresolved promises

**Issue**: Mock not working as expected

- **Solution**: Verify mock setup is correct
- **Solution**: Print mock call history: `console.log(mockRepository.save.mock.calls)`

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [TypeORM Testing](https://typeorm.io/usage-with-frameworks)
