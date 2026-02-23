# E2E Test Quick Reference

Quick commands for running e2e tests locally.

## Quick Setup

```bash
# One-time setup with the provided script
chmod +x scripts/setup-e2e-tests.sh
./scripts/setup-e2e-tests.sh

# Or manually:
npm run test:e2e:setup
```

## Running Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run only admin e2e tests
npm run test:e2e:admin

# Setup and then run admin tests
npm run test:e2e:setup && npm run test:e2e:admin
```

## Individual Commands

```bash
# Create test database (one-time)
createdb -h localhost -U postgres gasless_test

# Run migrations on test database
npm run migration:run:test

# Seed test data
npm run seed:test

# Both migrations + seed
npm run test:e2e:setup
```

## Environment

Set these env vars (or use `.env.test`):

```env
NODE_ENV=test
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=gasless_stellar
DATABASE_NAME_TEST=gasless_test
```

## Test Data Login Credentials

### Admin Accounts
- **SUPER_ADMIN**: superadmin@test.local / Test@123456
- **ADMIN**: admin@test.local / Test@123456  
- **MODERATOR**: moderator@test.local / Test@123456

### Regular Users
- Pattern: `user0@test.local` through `user99@test.local`
- Password: `Test@123456` (all users)

## What Gets Seeded

- **100 users** (3 admin + 97 regular)
  - 70 active
  - 20 banned
  - 10 suspended
- **50 rooms** (20 public, 15 private, 10 token-gated, 5 timed)
- **~400+ room memberships**
- **500 messages**
- **200 transactions** (150 P2P, 50 bulk)

## Troubleshooting

**PostgreSQL not running:**
```bash
# MacOS
brew services start postgres

# Linux
sudo systemctl start postgresql
```

**Database doesn't exist:**
```bash
npm run test:e2e:setup
```

**Migration errors:**
```bash
# Check status
npm run typeorm migration:show -- -d ./src/config/data-source-test.ts

# Rollback
npm run typeorm migration:revert -- -d ./src/config/data-source-test.ts
```

**Need fresh database:**
```bash
dropdb -h localhost -U postgres gasless_test
npm run test:e2e:setup
```

## CI/CD

GitHub Actions automatically:
1. Provisions PostgreSQL 15 & Redis 7 containers
2. Creates test databases
3. Runs migrations
4. Seeds test data
5. Runs e2e tests
6. Uploads artifacts

See `.github/workflows/e2e-tests.yml`

## Tips

- Tests are isolated per e2e file
- Seeds are idempotent (safe to re-run)
- Global setup/teardown auto-runs before/after all tests
- Test timeout: 30s per file (configurable in jest-e2e.json)
- Use `NODE_ENV=test` to enable test database switching
