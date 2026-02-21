# IP Whitelist Security Feature

## Overview

The IP Whitelist feature provides an additional security layer for admin API endpoints by restricting access to known IP addresses or CIDR ranges.

## Features

- **CIDR Notation Support**: Whitelist individual IPs or entire ranges (e.g., `192.168.1.0/24`)
- **SUPER_ADMIN Only**: Only users with SUPER_ADMIN role can manage the whitelist
- **Audit Logging**: All whitelist changes are logged with HIGH severity
- **Toggle-able**: Enable/disable via environment variable without code changes
- **Graceful Fallback**: If whitelist is empty, all IPs are allowed (when enabled)

## Configuration

### Environment Variable

Add to your `.env` file:

```env
ADMIN_IP_WHITELIST_ENABLED=true
```

Set to `false` or omit to disable the feature.

### Database Migration

Run the migration to create the `ip_whitelist` table:

```bash
npm run migration:run
```

## API Endpoints

All endpoints require `SUPER_ADMIN` role and JWT authentication.

### List Whitelisted IPs

```http
GET /admin/security/ip-whitelist
```

**Response:**
```json
[
  {
    "id": "uuid",
    "ipCidr": "192.168.1.100/32",
    "description": "Office network",
    "addedBy": "user-uuid",
    "addedByUser": {
      "id": "user-uuid",
      "username": "admin"
    },
    "createdAt": "2026-02-20T23:00:00.000Z"
  }
]
```

### Add IP to Whitelist

```http
POST /admin/security/ip-whitelist
Content-Type: application/json

{
  "ipCidr": "192.168.1.0/24",
  "description": "Office network range"
}
```

**Valid CIDR formats:**
- Single IP: `192.168.1.100` or `192.168.1.100/32`
- IP range: `192.168.1.0/24`, `10.0.0.0/8`

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "ipCidr": "192.168.1.0/24",
  "description": "Office network range",
  "addedBy": "user-uuid",
  "createdAt": "2026-02-20T23:00:00.000Z"
}
```

### Remove IP from Whitelist

```http
DELETE /admin/security/ip-whitelist/:id
```

**Response:** `204 No Content`

## How It Works

1. **Middleware Check**: The `IpWhitelistMiddleware` intercepts all `/admin/*` requests
2. **Feature Toggle**: If `ADMIN_IP_WHITELIST_ENABLED` is not `true`, requests pass through
3. **Empty Whitelist**: If no entries exist, all IPs are allowed (fail-open for initial setup)
4. **IP Extraction**: Client IP is extracted from:
   - `X-Forwarded-For` header (first IP)
   - `X-Real-IP` header
   - Socket remote address
5. **CIDR Matching**: Client IP is checked against all whitelist entries using `ipaddr.js`
6. **Access Decision**: Request is allowed if IP matches any entry, otherwise `403 Forbidden`

## Security Considerations

### Initial Setup

⚠️ **Important**: Before enabling the feature, add your current IP to the whitelist to avoid locking yourself out:

```bash
# 1. Add your IP first (with feature disabled)
curl -X POST http://localhost:3000/admin/security/ip-whitelist \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ipCidr": "YOUR_IP_ADDRESS/32", "description": "My admin IP"}'

# 2. Then enable the feature
# Set ADMIN_IP_WHITELIST_ENABLED=true in .env
# Restart the server
```

### Behind Proxies/Load Balancers

If your app is behind a proxy (Nginx, CloudFlare, AWS ALB), ensure the proxy forwards the real client IP:

**Nginx:**
```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

**Express Trust Proxy:**
```typescript
// In main.ts
app.set('trust proxy', true);
```

### Audit Trail

All whitelist changes are logged with:
- **Event Type**: `ADMIN`
- **Severity**: `HIGH`
- **Actions**: `IP_WHITELIST_ADDED`, `IP_WHITELIST_REMOVED`
- **Metadata**: IP/CIDR, description, actor user

View audit logs:
```http
GET /admin/audit-logs?eventType=ADMIN&action=IP_WHITELIST_ADDED
```

## Testing

### Test IP Matching

```bash
# Add localhost
curl -X POST http://localhost:3000/admin/security/ip-whitelist \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ipCidr": "127.0.0.1/32", "description": "Localhost"}'

# Enable feature and test access
# Should work from localhost, fail from other IPs
```

### Test CIDR Ranges

```bash
# Add a range
curl -X POST http://localhost:3000/admin/security/ip-whitelist \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ipCidr": "192.168.1.0/24", "description": "Local network"}'

# Any IP from 192.168.1.0 to 192.168.1.255 will be allowed
```

## Troubleshooting

### Locked Out

If you accidentally lock yourself out:

1. **Disable the feature**:
   ```bash
   # Set in .env
   ADMIN_IP_WHITELIST_ENABLED=false
   # Restart server
   ```

2. **Or clear the whitelist** (direct database access):
   ```sql
   DELETE FROM ip_whitelist;
   ```

### IP Not Matching

Check what IP the server sees:

```typescript
// Add temporary logging in middleware
console.log('Client IP:', this.getClientIp(req));
```

Common issues:
- Behind proxy without proper headers
- IPv6 vs IPv4 mismatch
- VPN/dynamic IP changes

### Validation Errors

The DTO validates CIDR format. Valid examples:
- ✅ `192.168.1.100`
- ✅ `192.168.1.100/32`
- ✅ `10.0.0.0/8`
- ❌ `192.168.1` (incomplete)
- ❌ `192.168.1.0/33` (invalid CIDR)

## Dependencies

- **ipaddr.js**: CIDR matching and IP parsing
- **TypeORM**: Database entity management
- **NestJS**: Middleware and dependency injection

## Migration Details

The migration creates:
- Table: `ip_whitelist`
- Columns: `id`, `ipCidr` (CIDR type), `description`, `addedBy`, `createdAt`
- Foreign key: `addedBy` → `users.id` (CASCADE on delete)

## Future Enhancements

Potential improvements:
- IP whitelist per admin role (not just SUPER_ADMIN)
- Temporary whitelist entries with expiration
- Automatic IP detection and self-whitelisting
- Whitelist import/export
- Rate limiting per IP
- Geo-blocking integration
