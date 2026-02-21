# Quick Start Guide

Get the Admin Audit Log Service running in 5 minutes.

## 1. Setup Database

**Option A: Using Docker (Recommended)**

```bash
docker-compose up -d
```

**Option B: Using Existing PostgreSQL**

```bash
# Update .env with your database credentials
nano .env
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Build

```bash
npm run build
```

## 4. Start Application

```bash
npm start
```

Your service is now running on `http://localhost:3000`.

## 5. Verify Installation

```bash
# Health check
curl http://localhost:3000/health
```

## Common Commands

```bash
# Development mode (with auto-reload)
npm run start:dev

# Run tests
npm run test

# Run tests with coverage
npm run test:cov

# Format code
npm run format

# Lint code
npm run lint

# Build for production
npm run build

# Production start
npm run start:prod
```

## Integration Example

```typescript
import { Injectable } from '@nestjs/common';
import {
  AdminAuditLogService,
  AdminAuditLogAction,
  AuditLogTargetType,
} from './admin-audit-log';

@Injectable()
export class MyService {
  constructor(private auditLogService: AdminAuditLogService) {}

  async banUser(userId: string, adminId: string, adminEmail: string) {
    // ... ban user logic ...

    // Log the action (fire-and-forget)
    this.auditLogService.log({
      adminId,
      adminEmail,
      action: AdminAuditLogAction.BAN_USER,
      targetType: AuditLogTargetType.USER,
      targetId: userId,
      ipAddress: '192.168.1.1',
      metadata: { reason: 'Spam violation' },
    });
  }
}
```

## Query Example

```typescript
const logs = await adminAuditLogService.findAll({
  adminId: 'admin-uuid',
  action: AdminAuditLogAction.BAN_USER,
  startDate: new Date('2026-02-01'),
  endDate: new Date('2026-02-28'),
  page: 1,
  limit: 20,
});

console.log(logs);
// {
//   data: [...logs],
//   pagination: { total: X, page: 1, limit: 20, pages: Y }
// }
```

## Project Structure

```
src/
├── admin-audit-log/          # Main module
│   ├── entities/             # Database entities
│   ├── enums/                # TypeScript enums
│   ├── dto/                  # Data transfer objects
│   ├── admin-audit-log.service.ts
│   ├── admin-audit-log.module.ts
│   └── admin-audit-log.service.spec.ts
├── database/
│   └── migrations/           # TypeORM migrations
├── app.module.ts
└── main.ts
```

## Key Features

✅ **Immutable Logging** - Fire-and-forget audit trail  
✅ **Advanced Filtering** - Query by admin, action, target, date range  
✅ **Pagination** - Built-in pagination support  
✅ **Type Safe** - Full TypeScript support  
✅ **Tested** - Comprehensive unit tests  
✅ **Production Ready** - Error handling, indexing, security

## Documentation

- **README.md** - Complete documentation
- **INTEGRATION_GUIDE.md** - How to use in your services
- **EXAMPLES.md** - Real-world use cases
- **TESTING.md** - Testing guide
- **DEPLOYMENT.md** - Production deployment

## Environment Variables

```env
DB_HOST=localhost              # PostgreSQL host
DB_PORT=5432                   # PostgreSQL port
DB_USERNAME=postgres           # Database user
DB_PASSWORD=password           # Database password
DB_DATABASE=admin_audit_log_db # Database name
PORT=3000                      # Application port
NODE_ENV=development           # Environment
```

## Troubleshooting

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart database
docker-compose down
docker-compose up -d

# Verify connection
docker-compose exec postgres psql -U postgres -d admin_audit_log_db -c "SELECT 1;"
```

### Port Already in Use

```bash
# Change port in .env
PORT=3001

# Or kill existing process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Migration Failed

```bash
# Build first
npm run build

# Run specific migration
npm run typeorm migration:run

# Check migration status
npm run typeorm migration:show
```

## Performance Tips

1. **Use Batch Logging** for bulk operations

```typescript
await auditLogService.logBatch(auditLogs);
```

2. **Filter Queries Specifically**

```typescript
// Good - with filters
findAll({ adminId: '...', action: 'BAN_USER', limit: 20 });

// Bad - retrieves all logs
findAll({ limit: 20 });
```

3. **Set Appropriate Page Limits**

```typescript
// Recommended: 20-50 per page
limit: 20;
```

## Support

For detailed documentation, see:

- [README.md](README.md) - Full documentation
- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) - How to integrate
- [TESTING.md](TESTING.md) - Testing guide

## Next Steps

1. Import `AdminAuditLogModule` in your admin modules
2. Inject `AdminAuditLogService` where needed
3. Call `log()` for each admin action
4. Query logs using `findAll()` with filters

Happy auditing! 🚀
