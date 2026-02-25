# Content Moderation API

Admin tools for moderating content, managing reports, and auditing moderation actions.

## Setup

### 1. Run Migrations

```bash
npm run migration:run
```

This creates:
- `reports` table - User-submitted content reports
- `admin_actions` table - Audit log of all admin actions

### 2. Ensure Admin User Exists

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

## API Endpoints

### Public Endpoints (Authenticated Users)

#### POST /reports

Submit a report for inappropriate content.

**Authentication:** Required (any user)

**Request Body:**
```json
{
  "targetType": "MESSAGE",
  "targetId": "msg-123",
  "reason": "Inappropriate content"
}
```

**Target Types:**
- `MESSAGE` - Report a message
- `ROOM` - Report a room
- `USER` - Report a user

**Response:**
```json
{
  "id": "uuid",
  "reporterId": "uuid",
  "targetType": "MESSAGE",
  "targetId": "msg-123",
  "reason": "Inappropriate content",
  "status": "PENDING",
  "reviewedById": null,
  "reviewedAt": null,
  "createdAt": "2026-02-25T14:00:00Z",
  "updatedAt": "2026-02-25T14:00:00Z"
}
```

---

### Admin Endpoints

All admin endpoints require:
- Valid JWT token
- User role = 'ADMIN'

#### GET /admin/reports

List all reports with optional filtering.

**Query Parameters:**
- `status` (optional): `PENDING` | `REVIEWED` | `DISMISSED`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "reporter": {
        "id": "uuid",
        "username": "user123",
        "email": "user@example.com"
      },
      "targetType": "MESSAGE",
      "targetId": "msg-123",
      "reason": "Inappropriate content",
      "status": "PENDING",
      "reviewedBy": null,
      "reviewedAt": null,
      "createdAt": "2026-02-25T14:00:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

---

#### PATCH /admin/reports/:id

Review a report and update its status.

**Request Body:**
```json
{
  "status": "REVIEWED",
  "notes": "Action taken - user warned"
}
```

**Status Options:**
- `REVIEWED` - Report reviewed and action taken
- `DISMISSED` - Report dismissed as invalid

**Response:**
```json
{
  "id": "uuid",
  "status": "REVIEWED",
  "reviewedById": "admin-uuid",
  "reviewedAt": "2026-02-25T14:30:00Z",
  ...
}
```

**Audit Log:** Creates entry in `admin_actions` table

---

#### POST /admin/users/:id/ban

Ban a user from the platform.

**Request Body:**
```json
{
  "reason": "Repeated violations of community guidelines"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User banned successfully"
}
```

**Effects:**
- Sets `user.isBanned = true`
- Logs action to `admin_actions` table
- User cannot access platform

---

#### POST /admin/rooms/:id/remove

Remove a room from the platform.

**Request Body:**
```json
{
  "reason": "Violates terms of service"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room removed successfully"
}
```

**Audit Log:** Creates entry in `admin_actions` table

---

## Database Schema

### reports

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| reporter_id | uuid | User who submitted report |
| target_type | enum | MESSAGE/ROOM/USER |
| target_id | varchar | ID of reported content |
| reason | text | Report reason |
| status | enum | PENDING/REVIEWED/DISMISSED |
| reviewed_by | uuid | Admin who reviewed (nullable) |
| reviewed_at | timestamp | Review timestamp (nullable) |
| created_at | timestamp | Report creation time |
| updated_at | timestamp | Last update time |

**Indexes:**
- `(status, created_at)` - Fast filtering by status

---

### admin_actions

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| admin_id | uuid | Admin who performed action |
| action_type | enum | BAN_USER/REMOVE_ROOM/REVIEW_REPORT |
| target_id | varchar | ID of affected entity |
| reason | text | Action reason |
| metadata | jsonb | Additional context (nullable) |
| created_at | timestamp | Action timestamp |

**Indexes:**
- `(admin_id, created_at)` - Audit by admin
- `(action_type, created_at)` - Audit by action type

---

## Testing

```bash
# Run E2E tests
npm run test:e2e -- --testNamePattern="Content Moderation"

# Test report submission
curl -X POST http://localhost:3001/reports \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetType": "MESSAGE",
    "targetId": "msg-123",
    "reason": "Spam"
  }'

# Test admin report listing
curl http://localhost:3001/admin/reports?status=PENDING \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Test user ban
curl -X POST http://localhost:3001/admin/users/user-123/ban \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Repeated violations"
  }'
```

---

## Audit Trail

All admin actions are automatically logged to the `admin_actions` table with:
- Admin who performed the action
- Action type
- Target entity ID
- Reason provided
- Additional metadata (username, email, etc.)
- Timestamp

Query audit logs:
```sql
-- Recent admin actions
SELECT * FROM admin_actions 
ORDER BY created_at DESC 
LIMIT 50;

-- Actions by specific admin
SELECT * FROM admin_actions 
WHERE admin_id = 'admin-uuid' 
ORDER BY created_at DESC;

-- User bans
SELECT * FROM admin_actions 
WHERE action_type = 'BAN_USER' 
ORDER BY created_at DESC;
```

---

## Security

- Report submission requires authentication (prevents spam)
- Admin endpoints protected by `AdminGuard`
- All moderation actions logged for accountability
- Soft delete pattern preserves data integrity
- Foreign key constraints maintain referential integrity

---

## Future Enhancements

- Email notifications for report status changes
- Bulk moderation actions
- Automated content filtering
- Appeal system for banned users
- Moderation dashboard UI
- Report analytics and trends
