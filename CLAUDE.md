# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Gasless Gossip** ("whspr_stellar") — a gamified, on-chain messaging platform. The root of this repo is a **NestJS backend** (not inside an `api/` subfolder as the README implies). Additional components:

- `contracts/whsper_stellar/` — Rust/Soroban smart contracts for Stellar blockchain
- `django-app/` — A separate Django REST + Channels messaging API (standalone)

## Commands

### Development
```bash
npm run start:dev        # Start NestJS in watch mode
npm run start:debug      # Start with debug + watch
npm run build            # Compile TypeScript
npm run start:prod       # Run compiled output
```

### Testing
```bash
npm run test             # Unit tests (*.spec.ts in src/)
npm run test:watch       # Unit tests in watch mode
npm run test:cov         # Unit tests with coverage
npm run test:e2e         # E2E tests (*.e2e-spec.ts in test/)
npm run test:e2e:admin   # E2E tests matching "admin" pattern

# Run a single test file
npx jest src/path/to/file.spec.ts

# E2E test setup (run migrations + seed test DB)
npm run test:e2e:setup
```

### Linting & Formatting
```bash
npm run lint             # ESLint with auto-fix
npm run format           # Prettier format
```

### Database Migrations
```bash
npm run migration:run                                          # Apply pending migrations
npm run migration:revert                                       # Revert last migration
npm run migration:generate -- src/database/migrations/Name    # Generate migration from entity diff
npm run migration:create -- src/database/migrations/Name      # Create empty migration
```

`synchronize: false` is enforced — always use migrations, never rely on auto-sync.

## Architecture

### Core NestJS Modules (`src/`)

| Module | Path | Purpose |
|--------|------|---------|
| `auth` | `src/auth/` | User JWT authentication (access + refresh tokens via `JwtStrategy` and `JwtRefreshStrategy`) |
| `user` | `src/user/` | Core user entity + CRUD |
| `users` | `src/users/` | Extended user profile (note: two separate user modules exist) |
| `admin` | `src/admin/` | Admin dashboard: audit logs, IP whitelist, broadcast, platform config, withdrawal management |
| `room` | `src/room/` | Chat rooms: token-gated, timed, paid access; analytics, invitations, roles |
| `message` | `src/message/` | Message CRUD, reactions, edit history |
| `transfer` | `src/transfer/` | P2P token transfers (no fees) |
| `chain` | `src/chain/` | EVM blockchain integration (ethers.js), multi-chain (BNB, Celo, Base, Ethereum) |
| `gasless` | `src/gasless/` | Account abstraction / sponsored transactions |
| `notifications` | `src/notifications/` | Push notifications, broadcast notifications, delivery tracking |
| `quest` | `src/quest/` | Quest/achievement system, XP tracking |
| `rewards` | `src/rewards/` | Reward distribution |
| `leaderboard` | `src/leaderboard/` | Leaderboard rankings |
| `moderation` | `src/moderation/` | Content moderation, spam detection, flagged messages, room moderation settings |
| `sessions` | `src/sessions/` | User session management |
| `queue` | `src/queue/` | Bull queue management (Redis-backed async jobs) |
| `redis` | `src/redis/` | Shared Redis client module |
| `system-config` | `src/system-config/` | Platform-wide config (maintenance mode, etc.) |
| `health` | `src/health/` | Health check endpoint |

### Global Guards (applied to every route)

1. **`JwtAuthGuard`** — Requires valid JWT. Use `@Public()` decorator to opt out.
2. **`UserThrottlerGuard`** — Rate limiting via Redis (10 req/60s default). Use `@RateLimit()` to override.
3. **`MaintenanceGuard`** — Blocks requests when maintenance mode is active.

### Admin vs User Authentication

Two separate JWT systems:
- **User JWT**: `JWT_SECRET` / `JWT_EXPIRES_IN` — standard user auth
- **Admin JWT**: `ADMIN_JWT_SECRET` / `ADMIN_JWT_EXPIRES_IN` — separate secret for admin panel

Admin routes are under `/admin/*` and additionally protected by `IpWhitelistMiddleware`.

Swagger docs (non-production only): `http://localhost:3000/admin/docs`

### Admin Module Substructure

`src/admin/` has its own `auth/` subdirectory (`AdminAuthModule`) with separate strategies. Key services:
- `AuditLogService` — logs all admin actions
- `IpWhitelistService` — restricts admin access by IP
- `AdminBroadcastService` / `BroadcastDeliveryStatsService` — platform-wide notifications
- `AdminQuestService` — quest management
- Scheduled jobs: `AuditLogRetentionJob`, `TemporaryBanCleanupJob`, `AutoUnbanProcessor`
- WebSocket gateway: `AdminEventStreamGateway` for real-time admin events

### Event Flow

- **Bull queues** handle async jobs (wallet creation, notifications, anomaly detection checks every 10 min)
- **`EventEmitterModule`** (`@nestjs/event-emitter`) handles intra-module events
- **Socket.io** WebSockets for real-time messaging and admin event streams

### Database

- PostgreSQL via TypeORM
- Data source config: `src/config/data-source.ts` (production), `src/config/data-source-test.ts` (test)
- Migrations in `src/database/migrations/`
- Seeders in `src/database/seeders/`
- On startup, `RolesSeederService.seed()` runs to ensure roles/permissions exist

## Required Environment Variables

```env
# Database
DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME

# Auth
JWT_SECRET, JWT_EXPIRES_IN
ADMIN_JWT_SECRET, ADMIN_JWT_EXPIRES_IN, ADMIN_JWT_REFRESH_EXPIRES_IN

# Redis
REDIS_HOST, REDIS_PORT, REDIS_PASSWORD (optional), REDIS_DB

# Blockchain (EVM)
EVM_RPC_URL, EVM_PRIVATE_KEY
# Per-chain (optional): CHAIN_{ETHEREUM,BNB,CELO,BASE}_RPC_URL, CHAIN_{...}_CONTRACT_ADDRESS

# Storage
PINATA_JWT, PINATA_GATEWAY_URL

# Admin behavior
ADMIN_MAX_LOGIN_ATTEMPTS, ADMIN_LOCKOUT_DURATION_MS, ADMIN_LARGE_TRANSACTION_THRESHOLD
```

## Anomaly Detection

Located in `src/Security alerts and anomaly detection/` (note: unusual directory name with spaces). Runs as a cron job every 10 minutes detecting: spam, wash trading, early withdrawals, IP registration fraud, admin logins from new IPs.

## Django App

`django-app/` is an independent Django 4.2 + DRF + Channels app. Run it separately:
```bash
cd django-app
python manage.py runserver         # REST API on :8000
daphne gassless_gossip.asgi:application  # WebSocket support
pytest                              # Tests (97% coverage)
```

## Stellar Smart Contract

`contracts/whsper_stellar/` is a Rust crate using the Soroban SDK. Build/test separately with Cargo.

## Notes

- Several `src/` subdirectories have names with spaces (e.g., `src/AdminGuard and Role-based Access Control decorators/`, `src/Security alerts and anomaly detection/`). These are stale feature-branch leftovers; the live code is in the standard module directories.
- Coverage threshold enforced at 80% lines for admin module unit tests.
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
