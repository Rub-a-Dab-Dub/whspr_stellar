# Add this section to your main README.md

## 🎛️ Platform Configuration System

**NEW:** Runtime configuration management without redeployment!

Admins can now update platform settings on-the-fly:
- XP multipliers for events
- Platform fee percentages
- Allowed emoji reactions
- Rate limits
- Feature flags

### Quick Start

```bash
# 1. Run database migration
psql -h localhost -p 5432 -U postgres -d whspr \
  -f src/database/migrations/platform-config-setup.sql

# 2. Make yourself an admin
psql -h localhost -p 5432 -U postgres -d whspr \
  -c "UPDATE users SET \"isAdmin\" = TRUE WHERE email = 'your-email@example.com';"

# 3. Start the app
npm run start:dev
```

### API Usage

```bash
# List all configuration
GET /admin/config

# Update a config value
PATCH /admin/config/xp_multiplier
{
  "value": 2.0,
  "description": "Double XP weekend!"
}

# View audit log
GET /admin/config/audit
```

### Use in Code

```typescript
import { ConfigService } from './platform-config/config.service';

// Get XP multiplier
const multiplier = await this.configService.get<number>('xp_multiplier');

// Check feature flag
const flags = await this.configService.get('feature_flags');
const tippingEnabled = flags?.tipping ?? false;
```

### Features

✅ Redis caching (1-hour TTL)
✅ Automatic cache invalidation
✅ Full audit trail
✅ Admin-only access
✅ Startup validation
✅ Type-safe access

📚 **Full Documentation:** See [PLATFORM_CONFIG.md](./PLATFORM_CONFIG.md)
