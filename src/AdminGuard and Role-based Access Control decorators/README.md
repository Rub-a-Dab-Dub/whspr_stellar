# Admin Guards & Decorators — NestJS

A reusable, zero-boilerplate RBAC system for admin endpoints.

## File Structure

```
src/admin/
├── enums/
│   └── admin-role.enum.ts        # AdminRole enum + hierarchy helpers
├── decorators/
│   ├── admin-roles.decorator.ts  # @AdminRoles(...roles)
│   └── current-admin.decorator.ts# @CurrentAdmin()
├── guards/
│   ├── admin.guard.ts            # Validates admin JWT, throws ForbiddenException for non-admins
│   └── admin-roles.guard.ts      # Enforces least-privilege via role hierarchy
├── strategies/
│   └── admin-jwt.strategy.ts     # Passport 'admin-jwt' strategy
├── admin.controller.ts           # Example controller with composable guards
├── admin.module.ts               # Module wiring
├── admin-guards.spec.ts          # Unit tests (all role combos + denial scenarios)
└── index.ts                      # Barrel exports
```

## Role Hierarchy

```
SUPER_ADMIN  ←  highest privilege
    ↓
  ADMIN
    ↓
MODERATOR    ←  lowest privilege
```

A user automatically satisfies any **lower** role requirement.

## Usage

### 1. Apply guards to a controller

```ts
@Controller('admin')
@UseGuards(AdminGuard, AdminRolesGuard)   // always in this order
export class AdminController {}
```

### 2. Restrict individual routes

```ts
// Any authenticated admin
@Get('dashboard')
getDashboard() {}

// ADMIN or SUPER_ADMIN only
@Get('users')
@AdminRoles(AdminRole.ADMIN)
listUsers() {}

// SUPER_ADMIN only
@Delete('admins/:id')
@AdminRoles(AdminRole.SUPER_ADMIN)
deleteAdmin(@Param('id') id: string) {}
```

### 3. Access the current admin

```ts
@Get('me')
getMe(@CurrentAdmin() admin: AdminUser) {
  return admin;
}
```

## Environment Variables

| Variable           | Default         | Description                  |
|--------------------|-----------------|------------------------------|
| `ADMIN_JWT_SECRET` | `admin-secret`  | Secret used to sign/verify admin JWTs |

## JWT Payload Shape

```json
{
  "sub": "admin-uuid",
  "email": "admin@example.com",
  "role": "super_admin",
  "isAdmin": true
}
```

The `isAdmin: true` flag is **required** — `AdminGuard` will throw `ForbiddenException` without it.

## Running Tests

```bash
npx jest src/admin/admin-guards.spec.ts
```

## Guard Execution Order

```
Request → AdminGuard (validates JWT + isAdmin flag)
        → AdminRolesGuard (reads @AdminRoles metadata, checks hierarchy)
        → Route handler
```
