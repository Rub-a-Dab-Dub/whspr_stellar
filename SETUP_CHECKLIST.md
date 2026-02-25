# Admin Dashboard API - Setup Checklist

## ✅ Implementation Complete

All code has been written and is ready to deploy.

## 🚀 Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Database Migration
```bash
npm run migration:run
```

This adds the `role` column to the `users` table.

### 3. Create Admin User
```sql
-- Connect to your database
psql -U postgres -d whspr

-- Set a user as admin
UPDATE users SET role = 'ADMIN' WHERE email = 'your-admin@email.com';
```

### 4. Start Redis (if not running)
```bash
# Using Docker (recommended)
npm run docker:start

# Or standalone
redis-server
```

### 5. Start the Application
```bash
npm run start:dev
```

### 6. Test the API

Get an admin JWT token:
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-admin@email.com","password":"your-password"}'
```

Test the overview endpoint:
```bash
curl http://localhost:3001/admin/stats/overview \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Expected response:
```json
{
  "totalUsers": 1250,
  "dau": 340,
  "mau": 890,
  "totalRooms": 45,
  "transactions24h": 127
}
```

## 📋 All Endpoints

1. **GET /admin/stats/overview** - Platform overview
2. **GET /admin/stats/users?period=month&page=1&limit=30** - User growth
3. **GET /admin/stats/messages?period=week** - Message volume
4. **GET /admin/stats/payments?startDate=2026-02-01&endDate=2026-02-25** - Payments & fees
5. **GET /admin/stats/rooms** - Room statistics

## 🔒 Security

- All endpoints require valid JWT token
- User must have `role = 'ADMIN'`
- Non-admin users receive 403 Forbidden

## 📊 Features

✅ Redis caching (5-minute TTL)  
✅ Pagination support  
✅ Date range filtering  
✅ Period presets (day/week/month/year)  
✅ Fee calculation (2% platform fee)  
✅ Daily granularity for time-series data  

## 🧪 Run Tests

```bash
npm run test:e2e -- --testNamePattern="Admin Stats"
```

## 📝 Documentation

See `src/admin/README.md` for detailed API documentation.

## ⚠️ Environment Variables

Ensure these are set in your `.env`:

```env
# Redis (required for caching)
REDIS_HOST=localhost
REDIS_PORT=6379

# Database (already configured)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASS=postgres
DATABASE_NAME=whspr

# JWT (already configured)
JWT_SECRET=your_secret_key
```

---

**Issue #313 Status: COMPLETE ✅**

All acceptance criteria met. Ready for review and deployment.
