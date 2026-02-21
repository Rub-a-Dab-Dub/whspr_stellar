# IP Whitelist - Quick Reference

## Quick Start

```bash
# 1. Run setup script
./scripts/setup-ip-whitelist.sh

# 2. Start server
npm run start:dev

# 3. Add your IP (get token from login first)
curl -X POST http://localhost:3000/admin/security/ip-whitelist \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ipCidr": "YOUR_IP/32", "description": "My IP"}'

# 4. Enable in .env
ADMIN_IP_WHITELIST_ENABLED=true

# 5. Restart server
```

## API Endpoints

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| GET | `/admin/security/ip-whitelist` | List all entries | SUPER_ADMIN |
| POST | `/admin/security/ip-whitelist` | Add IP/CIDR | SUPER_ADMIN |
| DELETE | `/admin/security/ip-whitelist/:id` | Remove entry | SUPER_ADMIN |

## Request Examples

### List Whitelist
```bash
curl http://localhost:3000/admin/security/ip-whitelist \
  -H "Authorization: Bearer TOKEN"
```

### Add Single IP
```bash
curl -X POST http://localhost:3000/admin/security/ip-whitelist \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ipCidr": "192.168.1.100/32",
    "description": "Office workstation"
  }'
```

### Add IP Range
```bash
curl -X POST http://localhost:3000/admin/security/ip-whitelist \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ipCidr": "192.168.1.0/24",
    "description": "Office network"
  }'
```

### Remove Entry
```bash
curl -X DELETE http://localhost:3000/admin/security/ip-whitelist/ENTRY_ID \
  -H "Authorization: Bearer TOKEN"
```

## CIDR Examples

| CIDR | Description | IP Range |
|------|-------------|----------|
| `192.168.1.100/32` | Single IP | 192.168.1.100 only |
| `192.168.1.0/24` | Class C subnet | 192.168.1.0 - 192.168.1.255 |
| `10.0.0.0/8` | Class A network | 10.0.0.0 - 10.255.255.255 |
| `172.16.0.0/12` | Private network | 172.16.0.0 - 172.31.255.255 |

## Environment Variables

```env
# Enable/disable feature
ADMIN_IP_WHITELIST_ENABLED=true  # or false
```

## Troubleshooting

### Locked Out?
```bash
# Option 1: Disable feature
# In .env: ADMIN_IP_WHITELIST_ENABLED=false
# Restart server

# Option 2: Clear whitelist (database access)
psql -d whspr_stellar -c "DELETE FROM ip_whitelist;"
```

### Check Your IP
```bash
# Public IP
curl https://api.ipify.org

# Local IP (Linux/Mac)
hostname -I | awk '{print $1}'
```

### Test IP Matching
```bash
# Add localhost for testing
curl -X POST http://localhost:3000/admin/security/ip-whitelist \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ipCidr": "127.0.0.1/32", "description": "Localhost"}'
```

## Behind Proxy?

If behind Nginx/CloudFlare/ALB, ensure proxy forwards real IP:

### Nginx Config
```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

### Express Config (main.ts)
```typescript
app.set('trust proxy', true);
```

## Audit Logs

View whitelist changes:
```bash
curl "http://localhost:3000/admin/audit-logs?eventType=ADMIN&action=IP_WHITELIST_ADDED" \
  -H "Authorization: Bearer TOKEN"
```

## Security Notes

- ⚠️ Always add your IP BEFORE enabling the feature
- ✅ Empty whitelist = all IPs allowed (fail-open)
- ✅ All changes logged with HIGH severity
- ✅ Only SUPER_ADMIN can manage whitelist
- ✅ Supports IPv4 and IPv6

## Files Reference

- **Entity**: `src/admin/entities/ip-whitelist.entity.ts`
- **Service**: `src/admin/services/ip-whitelist.service.ts`
- **Controller**: `src/admin/controllers/ip-whitelist.controller.ts`
- **Middleware**: `src/admin/middleware/ip-whitelist.middleware.ts`
- **Migration**: `src/database/migrations/1771627613658-CreateIpWhitelistTable.ts`
- **Docs**: `IP_WHITELIST.md`

## Common Use Cases

### Home Office
```json
{"ipCidr": "YOUR_HOME_IP/32", "description": "Home office"}
```

### Office Network
```json
{"ipCidr": "192.168.1.0/24", "description": "Office LAN"}
```

### VPN Range
```json
{"ipCidr": "10.8.0.0/24", "description": "Company VPN"}
```

### Cloud Provider
```json
{"ipCidr": "52.0.0.0/8", "description": "AWS IP range"}
```

## Testing

```bash
# Run tests
npm run test -- ip-whitelist

# Run specific test file
npm run test -- ip-whitelist.service.spec
npm run test -- ip-whitelist.middleware.spec

# Coverage
npm run test:cov
```
