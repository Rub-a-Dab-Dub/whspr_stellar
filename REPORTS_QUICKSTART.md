# Reports System - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies (30 seconds)
```bash
npm install bull
```

### Step 2: Setup Database (1 minute)
```bash
npm run migration:run
```

### Step 3: Create Reports Directory (5 seconds)
```bash
mkdir temp-reports
```

### Step 4: Ensure Redis is Running (30 seconds)
```bash
# Check if Redis is running
redis-cli ping

# If not running, start it:
# Linux/Mac:
redis-server

# Windows (WSL):
sudo service redis-server start

# Docker:
docker run -d -p 6379:6379 redis
```

### Step 5: Start Your Application (10 seconds)
```bash
npm run start:dev
```

---

## ✅ Test It Works

### 1. Login as Admin
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

Save the `accessToken` from the response.

### 2. Generate a Report
```bash
curl -X POST http://localhost:3000/admin/reports/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "users",
    "format": "csv",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z"
  }'
```

You'll get a response like:
```json
{
  "jobId": "abc-123-def-456",
  "estimatedCompletionMs": 5000
}
```

### 3. Check Status
```bash
curl -X GET http://localhost:3000/admin/reports/abc-123-def-456/status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Wait until status is `"complete"`.

### 4. Download Report
```bash
curl -X GET http://localhost:3000/admin/reports/abc-123-def-456/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -o users-report.csv
```

---

## 🎯 What You Get

### API Endpoints
- ✅ `POST /admin/reports/generate` - Create report job
- ✅ `GET /admin/reports/:jobId/status` - Check job status
- ✅ `GET /admin/reports/:jobId/download` - Download completed report

### Report Types
- ✅ `users` - User registration data
- ⚠️ `revenue` - Revenue summary (placeholder - needs implementation)
- ⚠️ `transactions` - Transaction details (placeholder - needs implementation)
- ⚠️ `rooms` - Room statistics (placeholder - needs implementation)

### Formats
- ✅ `csv` - Comma-separated values
- ✅ `json` - JSON format

### Automated Features
- ✅ Daily revenue report at midnight UTC
- ✅ Automatic cleanup after 24 hours
- ✅ Async processing with Bull queue
- ✅ Job status tracking

---

## 📚 Documentation

- **API Reference:** `REPORTS_API_DOCUMENTATION.md`
- **Testing Guide:** `REPORTS_TESTING_GUIDE.md`
- **Implementation Details:** `REPORTS_IMPLEMENTATION_SUMMARY.md`

---

## ⚠️ Important Notes

1. **Redis Required:** The system uses Redis for job queuing. Make sure it's running.
2. **Admin Role:** Only users with ADMIN role can access report endpoints.
3. **Placeholder Data:** Revenue, transactions, and rooms reports currently return sample data.
4. **24-Hour Retention:** Reports are automatically deleted after 24 hours.

---

## 🐛 Troubleshooting

### Redis Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution:** Start Redis server (see Step 4 above)

### Migration Error
```
relation "report_jobs" already exists
```
**Solution:** Table already exists, skip migration

### Permission Denied
```
403 Forbidden
```
**Solution:** Ensure you're logged in as an admin user

---

## 🎉 You're Done!

The reports system is now ready to use. Generate reports, check their status, and download them when complete.

For advanced usage and testing, see the full documentation files.
