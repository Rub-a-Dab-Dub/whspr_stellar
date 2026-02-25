# Platform Configuration System

Runtime configuration management for Gasless Gossip without redeployment.

## Features

- **Dynamic Configuration**: Update XP multipliers, fees, rate limits, and feature flags at runtime
- **Redis Caching**: Fast config reads with automatic cache invalidation
- **Audit Logging**: Track all config changes with user attribution
- **Startup Validation**: Ensures required config keys exist before app starts
- **Admin-Only Access**: Protected by JWT + Admin guard

## Configuration Keys

| Key | Type | Description | Default |
|-----|------|-------------|---------|
| `xp_multiplier` | number | XP multiplier for all activities | 1.0 |
| `platform_fee_percentage` | number | Platform fee % for tips/rooms | 2.0 |
| `allowed_reactions` | array | Allowed emoji reactions | `["👍","❤️","😂","😮","😢","🔥"]` |
| `rate_limit_messages_per_minute` | number | Message rate limit per user | 10 |
| `feature_flags` | object | Feature toggles | `{"tipping":true,"rooms":true,"reactions":true}` |

## API Endpoints

### List All Config
```bash
GET /admin/config
Authorization: Bearer <admin-jwt-token>
```

**Response:**
```json
[
  {
    "key": "xp_multiplier",
    "value": 1.0,
    "description": "XP multiplier for all activities",
    "updatedBy": "admin-user-id",
    "createdAt": "2026-02-25T14:30:00Z",
    "updatedAt": "2026-02-25T14:30:00Z"
  }
]
```

### Update Config
```bash
PATCH /admin/config/:key
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json

{
  "value": 2.0,
  "description": "Double XP weekend event"
}
```

**Response:**
```json
{
  "key": "xp_multiplier",
  "value": 2.0,
  "description": "Double XP weekend event",
  "updatedBy": "admin-user-id",
  "updatedAt": "2026-02-25T15:00:00Z"
}
```

### Get Audit Log
```bash
GET /admin/config/audit
Authorization: Bearer <admin-jwt-token>
```

**Response:**
```json
[
  {
    "key": "xp_multiplier",
    "value": 2.0,
    "updatedBy": "admin-user-id",
    "timestamp": "2026-02-25T15:00:00Z"
  }
]
```

## Usage in Code

```typescript
import { ConfigService } from './platform-config/config.service';

@Injectable()
export class SomeService {
  constructor(private configService: ConfigService) {}

  async calculateXP(baseXP: number): Promise<number> {
    const multiplier = await this.configService.get<number>('xp_multiplier');
    return baseXP * (multiplier || 1.0);
  }

  async isFeatureEnabled(feature: string): Promise<boolean> {
    const flags = await this.configService.get<Record<string, boolean>>('feature_flags');
    return flags?.[feature] ?? false;
  }
}
```

## Setup

### 1. Run Migrations
```bash
npm run migration:run
```

This creates:
- `platform_config` table with default values
- `isAdmin` column in `users` table

### 2. Create Admin User
```bash
# Set admin wallet in .env
ADMIN_WALLET_ADDRESS=0x...

# Run seeder
npm run seed:admin
```

Or manually in database:
```sql
UPDATE users SET "isAdmin" = true WHERE email = 'your-admin@email.com';
```

### 3. Configure Redis
Ensure Redis is running (Docker or local):
```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Cache Behavior

- **TTL**: 1 hour (3600 seconds)
- **Invalidation**: Automatic on config update
- **Fallback**: Reads from DB if cache miss
- **Audit Log**: Last 1000 changes stored in Redis

## Security

- **Authentication**: JWT required
- **Authorization**: Admin role required (`isAdmin: true`)
- **Audit Trail**: All changes logged with user ID and timestamp

## Testing

```bash
# Run e2e tests
npm run test:e2e -- platform-config

# Test specific scenario
npm run test:e2e -- --testNamePattern="should update config value"
```

## Troubleshooting

**App won't start - "Missing required config keys"**
- Run migrations: `npm run migration:run`
- Check database has default config entries

**Config updates not reflected**
- Verify Redis is running
- Check Redis connection in logs
- Cache invalidation happens automatically

**403 Forbidden on admin endpoints**
- Ensure user has `isAdmin: true` in database
- Verify JWT token is valid
- Check AdminGuard is applied to controller
