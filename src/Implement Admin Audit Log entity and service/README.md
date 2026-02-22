# Admin Audit Log Service

A NestJS implementation of an immutable audit log system for admin actions, providing compliance and security review capabilities.

## Features

✅ **AdminAuditLog TypeORM Entity** - Complete entity with all required fields
✅ **Database Migration** - TypeORM migration for creating the `admin_audit_logs` table
✅ **AdminAuditLogService** - Injectable service with async logging and querying
✅ **Fire-and-Forget Logging** - Non-blocking log operations with error capture
✅ **Advanced Filtering** - Query by action, admin, target, date range, and more
✅ **Pagination Support** - Full pagination for query results
✅ **Unit Tests** - Comprehensive test coverage for all service methods
✅ **Immutable Design** - Log-only table, no updates or deletes

## Project Structure

```
src/
├── admin-audit-log/
│   ├── entities/
│   │   ├── admin-audit-log.entity.ts      # Main entity definition
│   │   └── index.ts
│   ├── dto/
│   │   ├── create-admin-audit-log.dto.ts  # DTO for creating logs
│   │   ├── admin-audit-log-filter.dto.ts  # DTO for filtering queries
│   │   └── index.ts
│   ├── enums/
│   │   ├── admin-audit-log-action.enum.ts # Action types enum
│   │   ├── audit-log-target-type.enum.ts  # Target type enum
│   │   └── index.ts
│   ├── admin-audit-log.service.ts         # Core service logic
│   ├── admin-audit-log.service.spec.ts    # Unit tests
│   ├── admin-audit-log.module.ts          # NestJS module
│   └── index.ts
├── database/
│   └── migrations/
│       └── 1708540800000-CreateAdminAuditLog.ts  # Database migration
├── app.module.ts                           # Root module
└── main.ts                                 # Entry point
```

## Entity Fields

| Field        | Type               | Description                                                           |
| ------------ | ------------------ | --------------------------------------------------------------------- |
| `id`         | UUID               | Primary key, auto-generated                                           |
| `adminId`    | UUID               | Foreign key to User                                                   |
| `adminEmail` | VARCHAR            | Denormalized admin email for log integrity                            |
| `action`     | ENUM               | Action performed (LOGIN, LOGOUT, BAN_USER, etc.)                      |
| `targetType` | ENUM               | Type of resource affected (user, room, transaction, platform, system) |
| `targetId`   | VARCHAR (nullable) | ID of the affected resource                                           |
| `metadata`   | JSONB              | Additional context (before/after values, reason, etc.)                |
| `ipAddress`  | INET               | IP address of the admin                                               |
| `createdAt`  | TIMESTAMP          | Creation timestamp (immutable)                                        |

## Supported Actions

```typescript
enum AdminAuditLogAction {
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  BAN_USER = "BAN_USER",
  UNBAN_USER = "UNBAN_USER",
  DELETE_ROOM = "DELETE_ROOM",
  CLOSE_ROOM = "CLOSE_ROOM",
  WITHDRAW = "WITHDRAW",
  CONFIG_CHANGE = "CONFIG_CHANGE",
  PERMISSION_CHANGE = "PERMISSION_CHANGE",
  USER_CREATED = "USER_CREATED",
  USER_DELETED = "USER_DELETED",
  ROLE_ASSIGNED = "ROLE_ASSIGNED",
  ROLE_REVOKED = "ROLE_REVOKED",
  TRANSACTION_REVERSED = "TRANSACTION_REVERSED",
  SYSTEM_MAINTENANCE = "SYSTEM_MAINTENANCE",
  SECURITY_INCIDENT = "SECURITY_INCIDENT",
}
```

## Target Types

```typescript
enum AuditLogTargetType {
  USER = "user",
  ROOM = "room",
  TRANSACTION = "transaction",
  PLATFORM = "platform",
  SYSTEM = "system",
}
```

## Installation

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure database**
   - Copy `.env.example` to `.env`
   - Update database credentials

3. **Run migrations**
   ```bash
   npm run build
   npm start
   ```

## Usage

### Injecting the Service

```typescript
import { Injectable } from "@nestjs/common";
import { AdminAuditLogService } from "./admin-audit-log";

@Injectable()
export class UserService {
  constructor(private readonly adminAuditLogService: AdminAuditLogService) {}

  async banUser(userId: string, adminId: string, adminEmail: string) {
    // Perform ban operation

    // Log the action (fire-and-forget, non-blocking)
    this.adminAuditLogService.log({
      adminId,
      adminEmail,
      action: AdminAuditLogAction.BAN_USER,
      targetType: AuditLogTargetType.USER,
      targetId: userId,
      metadata: {
        reason: "Spam violation",
        duration: "30 days",
      },
      ipAddress: "192.168.1.1",
    });
  }
}
```

### Service Methods

#### `log(dto: CreateAdminAuditLogDto): Promise<void>`

Log a single admin action. Non-blocking, captures errors without throwing.

```typescript
await adminAuditLogService.log({
  adminId: "admin-uuid",
  adminEmail: "admin@example.com",
  action: AdminAuditLogAction.CONFIG_CHANGE,
  targetType: AuditLogTargetType.PLATFORM,
  metadata: {
    oldValue: { maxUsers: 100 },
    newValue: { maxUsers: 150 },
  },
});
```

#### `findAll(filters: AdminAuditLogFilterDto)`

Query logs with pagination and filtering.

```typescript
const result = await adminAuditLogService.findAll({
  adminId: "admin-uuid",
  action: AdminAuditLogAction.BAN_USER,
  targetType: AuditLogTargetType.USER,
  startDate: new Date("2026-02-01"),
  endDate: new Date("2026-02-28"),
  page: 1,
  limit: 20,
});

// Returns:
// {
//   data: [AdminAuditLog[], ...],
//   pagination: {
//     total: 150,
//     page: 1,
//     limit: 20,
//     pages: 8
//   }
// }
```

#### `findByAdminId(adminId: string, limit?: number, offset?: number)`

Get logs for a specific admin with pagination.

```typescript
const result = await adminAuditLogService.findByAdminId("admin-uuid", 10, 0);
// Returns: { data: [...], total: X, limit: 10, offset: 0 }
```

#### `findById(id: string)`

Get a specific audit log entry.

```typescript
const log = await adminAuditLogService.findById("log-uuid");
```

#### `countByAction(action: AdminAuditLogAction)`

Count logs of a specific action type.

```typescript
const loginCount = await adminAuditLogService.countByAction(
  AdminAuditLogAction.LOGIN,
);
```

#### `getAdminIds()`

Get all distinct admin IDs from logs.

```typescript
const adminIds = await adminAuditLogService.getAdminIds();
```

#### `logBatch(dtos: CreateAdminAuditLogDto[])`

Log multiple actions at once. Non-blocking, fire-and-forget.

```typescript
await adminAuditLogService.logBatch([
  { adminId: 'a1', adminEmail: 'a1@test.com', ... },
  { adminId: 'a2', adminEmail: 'a2@test.com', ... },
]);
```

## Database Indexes

The migration creates these indexes for optimal query performance:

- `IDX_admin_audit_logs_adminId` - Fast queries by admin
- `IDX_admin_audit_logs_action` - Fast queries by action
- `IDX_admin_audit_logs_targetType` - Fast queries by target type
- `IDX_admin_audit_logs_createdAt` - Fast queries by date
- `IDX_admin_audit_logs_adminId_createdAt` - Composite index for common queries

## Database Schema

```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adminId UUID NOT NULL,
  adminEmail VARCHAR(255) NOT NULL,
  action admin_audit_log_action_enum NOT NULL,
  targetType audit_log_target_type_enum NOT NULL,
  targetId VARCHAR(255),
  metadata JSONB,
  ipAddress INET,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IDX_admin_audit_logs_adminId ON admin_audit_logs(adminId);
CREATE INDEX IDX_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IDX_admin_audit_logs_targetType ON admin_audit_logs(targetType);
CREATE INDEX IDX_admin_audit_logs_createdAt ON admin_audit_logs(createdAt);
CREATE INDEX IDX_admin_audit_logs_adminId_createdAt ON admin_audit_logs(adminId, createdAt);
```

## Testing

Run the comprehensive unit test suite:

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:cov

# Run in watch mode
npm run test:watch
```

Test coverage includes:

- ✅ Basic logging functionality
- ✅ Fire-and-forget behavior with error handling
- ✅ Filtering by all available parameters
- ✅ Pagination with edge cases
- ✅ Date range queries
- ✅ Batch logging operations
- ✅ Error handling and recovery

## Environment Variables

```env
DB_HOST=localhost              # PostgreSQL host
DB_PORT=5432                   # PostgreSQL port
DB_USERNAME=postgres           # Database user
DB_PASSWORD=password           # Database password
DB_DATABASE=admin_audit_log_db # Database name
DB_LOGGING=false               # Enable TypeORM logging
PORT=3000                      # Application port
NODE_ENV=development           # Environment
```

## Key Features Implemented

### 1. Immutable Design

- No UPDATE or DELETE operations on audit logs
- Data integrity enforced at application level
- Timestamp automatically set on creation

### 2. Fire-and-Forget Logging

- `log()` and `logBatch()` methods are non-blocking
- Errors are captured and logged, not thrown
- Prevents audit logging from blocking admin operations

### 3. Comprehensive Filtering

- Filter by admin ID, action, target type, target ID, IP address
- Date range queries with `startDate` and `endDate`
- Combine multiple filters in a single query

### 4. Performance Optimized

- Strategic database indexes on commonly queried fields
- Pagination for large result sets
- Composite indexes for complex queries
- JSONB for flexible metadata storage

### 5. Production Ready

- Comprehensive error handling
- Full TypeScript type safety
- Unit tests with high coverage
- TypeORM migrations for database versioning
- PostgreSQL JSONB support for metadata

## Module Integration

The `AdminAuditLogModule` is exported and can be imported into any admin-related module:

```typescript
import { Module } from "@nestjs/common";
import { AdminAuditLogModule } from "./admin-audit-log";

@Module({
  imports: [AdminAuditLogModule],
})
export class AdminModule {}
```

## Development

```bash
# Start in development mode with watch
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Format code
npm run format

# Lint code
npm run lint
```

## License

MIT

## Compliance & Security

This audit log system is designed to meet compliance requirements:

- **Immutability**: Logs cannot be modified or deleted once created
- **Denormalized Data**: Admin email stored with each log for integrity
- **Comprehensive Context**: Metadata field captures before/after values
- **IP Tracking**: Admin IP address recorded for security review
- **Timestamp Integrity**: Server-side timestamps prevent manipulation
- **All Actions Tracked**: Every admin action has corresponding audit entry
