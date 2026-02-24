# Reports API Testing Guide

## Prerequisites

1. Install dependencies:
```bash
npm install bull
```

2. Ensure Redis is running:
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

3. Run the migration:
```bash
npm run migration:run
```

4. Start the application:
```bash
npm run start:dev
```

---

## Testing Workflow

### Step 1: Authenticate and Get Admin Token

First, login as an admin user to get a JWT token:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

Save the `accessToken` from the response.

---

### Step 2: Generate a Report

**Generate a Users Report (CSV):**

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

**Response:**
```json
{
  "jobId": "abc-123-def-456",
  "estimatedCompletionMs": 5000
}
```

Save the `jobId` for the next steps.

---

### Step 3: Check Report Status

Poll the status endpoint to check if the report is ready:

```bash
curl -X GET http://localhost:3000/admin/reports/abc-123-def-456/status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response (Processing):**
```json
{
  "jobId": "abc-123-def-456",
  "status": "processing",
  "type": "users",
  "format": "csv",
  "createdAt": "2024-01-15T10:00:00Z",
  "completedAt": null,
  "errorMessage": null
}
```

**Response (Complete):**
```json
{
  "jobId": "abc-123-def-456",
  "status": "complete",
  "type": "users",
  "format": "csv",
  "createdAt": "2024-01-15T10:00:00Z",
  "completedAt": "2024-01-15T10:00:05Z",
  "errorMessage": null
}
```

---

### Step 4: Download the Report

Once the status is `complete`, download the report:

```bash
curl -X GET http://localhost:3000/admin/reports/abc-123-def-456/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -o users-report.csv
```

The file will be saved as `users-report.csv` in your current directory.

---

## Testing All Report Types

### Revenue Report (JSON)

```bash
curl -X POST http://localhost:3000/admin/reports/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "revenue",
    "format": "json",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z"
  }'
```

### Transactions Report (CSV)

```bash
curl -X POST http://localhost:3000/admin/reports/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "transactions",
    "format": "csv",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z"
  }'
```

### Rooms Report (JSON)

```bash
curl -X POST http://localhost:3000/admin/reports/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "rooms",
    "format": "json",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z"
  }'
```

---

## Testing Error Cases

### Invalid Date Range (startDate after endDate)

```bash
curl -X POST http://localhost:3000/admin/reports/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "users",
    "format": "csv",
    "startDate": "2024-12-31T23:59:59Z",
    "endDate": "2024-01-01T00:00:00Z"
  }'
```

**Expected Response:**
```json
{
  "statusCode": 400,
  "message": "startDate must be before endDate"
}
```

### Future End Date

```bash
curl -X POST http://localhost:3000/admin/reports/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "users",
    "format": "csv",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2099-12-31T23:59:59Z"
  }'
```

**Expected Response:**
```json
{
  "statusCode": 400,
  "message": "endDate cannot be in the future"
}
```

### Download Before Completion

Try to download a report that's still processing:

```bash
curl -X GET http://localhost:3000/admin/reports/abc-123-def-456/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "statusCode": 400,
  "message": "Report is not ready. Current status: processing"
}
```

### Non-existent Job ID

```bash
curl -X GET http://localhost:3000/admin/reports/non-existent-id/status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "statusCode": 404,
  "message": "Report job non-existent-id not found"
}
```

---

## Testing Scheduled Reports

The daily revenue report runs automatically at midnight UTC. To test it manually:

1. Check the logs at midnight UTC for:
```
Generating daily revenue report...
Daily revenue report job created: {jobId}
```

2. Query the database to see scheduled reports:
```sql
SELECT * FROM report_jobs WHERE "isScheduled" = true ORDER BY "createdAt" DESC;
```

3. Download the scheduled report using its jobId:
```bash
curl -X GET http://localhost:3000/admin/reports/{jobId}/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -o daily-revenue.csv
```

---

## Testing Report Cleanup

Reports expire after 24 hours. To test the cleanup:

1. Generate a report and note its jobId
2. Wait 24 hours (or manually update the `expiresAt` field in the database)
3. Try to download the expired report:

```bash
curl -X GET http://localhost:3000/admin/reports/{jobId}/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "statusCode": 400,
  "message": "Report has expired and is no longer available"
}
```

4. Check the logs for cleanup messages:
```
Deleted expired report file: /path/to/temp-reports/revenue-1234567890.csv
Cleaned up X expired reports
```

---

## Monitoring Bull Queue

### Using Bull Board (Optional)

Install Bull Board for a web UI to monitor jobs:

```bash
npm install @bull-board/express @bull-board/api
```

Add to your app:

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullAdapter(reportsQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

Access at: `http://localhost:3000/admin/queues`

---

## Postman Collection

Import this collection into Postman for easier testing:

```json
{
  "info": {
    "name": "Reports API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Generate Report",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{accessToken}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"type\": \"users\",\n  \"format\": \"csv\",\n  \"startDate\": \"2024-01-01T00:00:00Z\",\n  \"endDate\": \"2024-12-31T23:59:59Z\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": {
          "raw": "{{baseUrl}}/admin/reports/generate",
          "host": ["{{baseUrl}}"],
          "path": ["admin", "reports", "generate"]
        }
      }
    },
    {
      "name": "Get Report Status",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{accessToken}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/admin/reports/{{jobId}}/status",
          "host": ["{{baseUrl}}"],
          "path": ["admin", "reports", "{{jobId}}", "status"]
        }
      }
    },
    {
      "name": "Download Report",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{accessToken}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/admin/reports/{{jobId}}/download",
          "host": ["{{baseUrl}}"],
          "path": ["admin", "reports", "{{jobId}}", "download"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "accessToken",
      "value": ""
    },
    {
      "key": "jobId",
      "value": ""
    }
  ]
}
```

---

## Troubleshooting

### Redis Connection Issues

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution:** Ensure Redis is running:
```bash
# Start Redis (Linux/Mac)
redis-server

# Start Redis (Windows with WSL)
sudo service redis-server start

# Or use Docker
docker run -d -p 6379:6379 redis
```

### Bull Queue Not Processing

**Check:**
1. Redis is running and accessible
2. Bull module is properly configured in app.module.ts
3. ReportProcessor is registered in admin.module.ts
4. Check application logs for errors

### Reports Directory Not Found

**Error:** `ENOENT: no such file or directory`

**Solution:** Create the directory:
```bash
mkdir -p temp-reports
```

### Migration Fails

**Error:** `relation "report_jobs" already exists`

**Solution:** The table already exists. Skip the migration or revert and re-run:
```bash
npm run migration:revert
npm run migration:run
```

---

## Performance Testing

### Load Testing with Apache Bench

Test concurrent report generation:

```bash
ab -n 100 -c 10 -T 'application/json' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -p report-payload.json \
  http://localhost:3000/admin/reports/generate
```

Where `report-payload.json` contains:
```json
{
  "type": "users",
  "format": "csv",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z"
}
```

---

## Next Steps

1. ✅ Install dependencies
2. ✅ Run migration
3. ✅ Test report generation
4. ✅ Test status checking
5. ✅ Test report download
6. ✅ Verify scheduled reports
7. ✅ Test cleanup after 24 hours
8. 📝 Implement actual data for revenue, transactions, and rooms reports
9. 📝 Add email notifications for completed reports
10. 📝 Add S3 storage integration for production
