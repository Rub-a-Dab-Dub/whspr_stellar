# E2E Test Environment Setup Guide

This guide explains how to set up and run reproducible e2e tests with realistic seed data.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- npm or pnpm

### Local Setup

1. **Create `.env.test` file** (or set environment variables):
```bash
NODE_ENV=test
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=gasless_stellar
DATABASE_NAME_TEST=gasless_test
JWT_SECRET=test-secret-key
ADMIN_JWT_SECRET=admin-test-secret
# ... other required env vars
```

2. **Set up test databases**:
```bash
# Create test database
createdb -h localhost -U postgres gasless_test

# Or use the provided script
chmod +x scripts/setup-e2e-tests.sh
./scripts/setup-e2e-tests.sh
```

3. **Run npm scripts**:
```bash
# Setup and seed the test database (runs migrations + seed data)
npm run test:e2e:setup

# Run all e2e tests
npm run test:e2e

# Run only admin e2e tests
npm run test:e2e:admin
```

## Architecture

### Database Strategy

The test environment uses a **separate test database** (`gasless_test`) to avoid conflicts with development/production data.

- **Database Name**: `gasless_test` (configured via `DATABASE_NAME_TEST` env var)
- **Configuration**: `src/config/data-source-test.ts`
- **Migrations**: Run against test database before seeding
- **Seed Script**: `src/database/seeders/seed-test-db.ts`

### Test Data

The seed script is **idempotent** - it clears all data and recreates it fresh each run.

```
100 Users:
├── 1 SUPER_ADMIN
├── 1 ADMIN
├── 1 MODERATOR
└── 97 Regular Users
    ├── 70 Active
    ├── 20 Banned
    └── 10 Suspended

50 Rooms:
├── 20 PUBLIC
├── 15 PRIVATE
├── 10 TOKEN_GATED
└── 5 TIMED

~400+ Room Members (5-30 per room)

500 Messages:
├── ~425 TEXT
├── ~50 IMAGE
└── ~25 SYSTEM

200 Transactions:
├── 120 P2P (80% completed, 12% pending, 8% failed)
├── 50 ROOM_PAYMENT
└── 30 REWARD
```

### npm Scripts

```bash
# Setup and configuration
npm run test:e2e:setup       # Run migrations and seed test data
npm run seed:test           # Seed test data only
npm run migration:run:test  # Run migrations on test database

# Running tests
npm run test:e2e            # Run all e2e tests
npm run test:e2e:admin      # Run only admin tests
npm run test:e2e:admin:full # Full setup + admin tests
```

## GitHub Actions CI/CD

The `.github/workflows/e2e-tests.yml` workflow:

1. **Triggers**: On push to main/develop, on pull requests
2. **Services**: PostgreSQL 15 + Redis 7 in containers
3. **Steps**:
   - Checkout code
   - Install dependencies
   - Create test databases
   - Run migrations
   - Seed test data
   - Run e2e tests
   - Upload test artifacts
   - Comment results on PR

### Workflow Features

- **Parallel Jobs**: 
  - Main e2e tests
  - Admin endpoint-specific tests
- **Service Containers**: PostgreSQL and Redis automatically provisioned
- **Health Checks**: Services wait until ready
- **Artifacts**: Test results uploaded for review
- **PR Comments**: Test summary posted to pull requests (when implemented)

## Test Database Configuration

### Data Source Files

**Production (default)**:
```typescript
// src/config/data-source.ts
database: process.env.DATABASE_NAME  // = gasless_stellar
```

**Testing**:
```typescript
// src/config/data-source-test.ts
database: process.env.DATABASE_NAME_TEST || 'gasless_test'
```

### Environment Variables

Add to your `.env` or set in CI:

```env
DATABASE_NAME_TEST=gasless_test    # Test database name
NODE_ENV=test                       # Set to 'test' mode
```

## Seed Data Details

### Admin Accounts

```
SUPER_ADMIN:
  Email: superadmin@test.local
  Password: Test@123456

ADMIN:
  Email: admin@test.local
  Password: Test@123456

MODERATOR:
  Email: moderator@test.local
  Password: Test@123456
```

### Test Users

```
Pattern: user{0-99}@test.local
Password: Test@123456 (all users)
Wallet: Random Ethereum-style addresses
States: Active (70%), Banned (20%), Suspended (10%)
```

### Room & Message Distribution

Rooms are distributed across all types with members having random roles and statuses. Messages are distributed across rooms with realistic timestamps over the last 60 days.

## Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check test database exists
psql -h localhost -U postgres -l | grep gasless_test

# Rebuild test database
dropdb gasless_test
npm run test:e2e:setup
```

### Migration Errors
```bash
# Check migration status
npm run typeorm migration:show -- -d ./src/config/data-source-test.ts

# Rollback if needed
npm run typeorm migration:revert -- -d ./src/config/data-source-test.ts
```

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping  # Should return PONG

# For macOS
brew services start redis
```

### Seed Script Fails
```bash
# Run with verbose logging
NODE_ENV=test npm run seed:test -- --verbose

# Check entity imports in seed-test-db.ts
```

## Manual Database Setup

If you prefer to set up manually:

```bash
# 1. Create databases
createdb -h localhost -U postgres gasless_stellar
createdb -h localhost -U postgres gasless_test

# 2. Run migrations
NODE_ENV=test npm run migration:run:test

# 3. Seed data
NODE_ENV=test npm run seed:test

# 4. Run tests
NODE_ENV=test npm run test:e2e
```

## Performance Considerations

- **Seed Time**: ~5-10 seconds with 100 users + 50 rooms + 500 messages + 200 transactions
- **Test Timeout**: 30s per test file (configurable in jest-e2e.json)
- **Database Cleanup**: Uses transaction rollback where possible for faster resets

## Best Practices

1. **Always use test database**: Never run tests against production/development data
2. **Keep seed idempotent**: Script should safely handle multiple runs
3. **Use realistic data**: Reflects actual user patterns and edge cases
4. **Test isolation**: Each test should be independent
5. **Regular updates**: Update seed data as schema changes

## Advanced: Custom Seed Data

To add custom test data, modify `src/database/seeders/seed-test-db.ts`:

```typescript
// Example: Add specific test user
const specialUser = userRepository.create({
  id: uuid(),
  email: 'special@test.local',
  // ... other fields
});
await userRepository.save(specialUser);
```

## CI/CD Integration

The test environment is production-ready for CI/CD:

- ✅ Containerized services (PostgreSQL, Redis)
- ✅ Idempotent setup
- ✅ Automatic cleanup
- ✅ Parallel test execution
- ✅ Artifact collection
- ✅ PR integration

See `.github/workflows/e2e-tests.yml` for GitHub Actions setup.
