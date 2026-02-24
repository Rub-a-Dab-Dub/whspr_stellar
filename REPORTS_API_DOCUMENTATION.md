# Reports API Documentation

## Overview
Automated report generation system with async job processing, scheduled reports, and temporary storage with automatic cleanup.

## Features
- Async report generation using Bull queues
- Multiple report types: revenue, users, transactions, rooms
- Multiple formats: CSV and JSON
- Scheduled daily revenue reports at midnight UTC
- Automatic cleanup of expired reports (24-hour retention)
- Job status tracking
- Streaming file downloads

## API Endpoints

### 1. Generate Report
**POST** `/admin/reports/generate`

Generate a new report asynchronously.

**Authentication:** Required (JWT)
**Authorization:** ADMIN role or above

**Request Body:**
```json
{
  "type": "revenue" | "users" | "transactions" | "rooms",
  "format": "csv" | "json",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z"
}
```

**Response:**
```json
{
  "jobId": "uuid",
  "estimatedCompletionMs": 10000
}
```

**Status Codes:**
- `200 OK` - Report job created successfully
- `400 Bad Request` - Invalid date range or parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions

**Example:**
```bash
curl -X POST http://localhost:3000/admin/reports/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "revenue",
    "format": "csv",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z"
  }'
```

---

### 2. Get Report Status
**GET** `/admin/reports/:jobId/status`

Check the status of a report generation job.

**Authentication:** Required (JWT)
**Authorization:** ADMIN role or above

**Path Parameters:**
- `jobId` (string, required) - The UUID of the report job

**Response:**
```json
{
  "jobId": "uuid",
  "status": "pending" | "processing" | "complete" | "failed",
  "type": "revenue",
  "format": "csv",
  "createdAt": "2024-01-01T00:00:00Z",
  "completedAt": "2024-01-01T00:00:10Z",
  "errorMessage": null
}
```

**Status Codes:**
- `200 OK` - Status retrieved successfully
- `404 Not Found` - Job not found
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions

**Example:**
```bash
curl -X GET http://localhost:3000/admin/reports/abc-123-def/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 3. Download Report
**GET** `/admin/reports/:jobId/download`

Download a completed report file.

**Authentication:** Required (JWT)
**Authorization:** ADMIN role or above

**Path Parameters:**
- `jobId` (string, required) - The UUID of the report job

**Response:**
- Streams the report file with appropriate Content-Type and Content-Disposition headers
- CSV files: `text/csv`
- JSON files: `application/json`

**Status Codes:**
- `200 OK` - File download started
- `400 Bad Request` - Report not ready or expired
- `404 Not Found` - Job or file not found
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions

**Example:**
```bash
curl -X GET http://localhost:3000/admin/reports/abc-123-def/download \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o report.csv
```

---

## Report Types

### 1. Users Report
Contains user registration data within the specified date range.

**Fields:**
- `id` - User UUID
- `email` - User email address
- `isVerified` - Email verification status
- `isBanned` - Ban status
- `roles` - Semicolon-separated role names
- `createdAt` - Registration timestamp
- `updatedAt` - Last update timestamp

### 2. Revenue Report
Contains revenue and transaction summary data.

**Fields:**
- `date` - Report date
- `totalRevenue` - Total revenue amount
- `transactionCount` - Number of transactions
- `averageTransaction` - Average transaction value

*Note: Currently returns placeholder data. Implement based on your transaction schema.*

### 3. Transactions Report
Contains detailed transaction data.

**Fields:**
- `id` - Transaction UUID
- `amount` - Transaction amount
- `type` - Transaction type (e.g., tip, payment)
- `status` - Transaction status
- `createdAt` - Transaction timestamp

*Note: Currently returns placeholder data. Implement based on your transaction schema.*

### 4. Rooms Report
Contains chat room statistics.

**Fields:**
- `id` - Room UUID
- `name` - Room name
- `memberCount` - Number of members
- `messageCount` - Number of messages
- `createdAt` - Room creation timestamp

*Note: Currently returns placeholder data. Implement based on your rooms schema.*

---

## Scheduled Reports

### Daily Revenue Report
- **Schedule:** Every day at midnight UTC (00:00)
- **Type:** Revenue
- **Format:** CSV
- **Date Range:** Previous day (00:00:00 to 23:59:59)
- **Requested By:** system

The scheduled report is automatically generated and stored with a 24-hour retention period.

---

## Report Lifecycle

1. **Creation** - Report job is created with status `pending`
2. **Queuing** - Job is added to Bull queue for processing
3. **Processing** - Status changes to `processing`, data is generated
4. **Completion** - Status changes to `complete`, file is saved with 24-hour expiration
5. **Download** - File can be downloaded via the download endpoint
6. **Cleanup** - After 24 hours, file is automatically deleted

---

## Storage

Reports are stored in the `temp-reports` directory at the project root.

**File naming convention:**
```
{reportType}-{timestamp}.{format}
```

Example: `revenue-1704067200000.csv`

**Retention:** 24 hours from completion time

---

## Error Handling

### Common Errors

**Invalid Date Range:**
```json
{
  "statusCode": 400,
  "message": "startDate must be before endDate"
}
```

**Future End Date:**
```json
{
  "statusCode": 400,
  "message": "endDate cannot be in the future"
}
```

**Report Not Ready:**
```json
{
  "statusCode": 400,
  "message": "Report is not ready. Current status: processing"
}
```

**Report Expired:**
```json
{
  "statusCode": 400,
  "message": "Report has expired and is no longer available"
}
```

**Job Not Found:**
```json
{
  "statusCode": 404,
  "message": "Report job abc-123-def not found"
}
```

---

## Configuration

### Bull Queue Configuration
The reports queue is configured in `src/app.module.ts`:

```typescript
BullModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    redis: {
      host: configService.get('redis.host'),
      port: configService.get('redis.port'),
    },
  }),
  inject: [ConfigService],
})
```

### Schedule Configuration
The scheduler is configured in `src/app.module.ts`:

```typescript
ScheduleModule.forRoot()
```

---

## Implementation Notes

### Extending Report Types

To add a new report type:

1. Add the type to the `ReportType` enum in `src/admin/entities/report-job.entity.ts`
2. Implement the data generation method in `src/admin/processors/report.processor.ts`
3. Update the `generateReportData` switch statement
4. Add estimation time in `estimateCompletionTime` method

### Custom Scheduled Reports

To add custom scheduled reports, add a new method in `src/admin/services/reports.service.ts`:

```typescript
@Cron(CronExpression.EVERY_WEEK)
async generateWeeklyReport() {
  // Implementation
}
```

---

## Testing

Run the report tests:

```bash
npm test -- admin.controller.spec.ts
```

---

## Dependencies

- `@nestjs/bull` - Bull queue integration
- `bull` - Job queue library
- `@nestjs/schedule` - Cron job scheduling
- `typeorm` - Database ORM

Install missing dependencies:

```bash
npm install bull
```

---

## Migration

Run the migration to create the `report_jobs` table:

```bash
npm run migration:run
```

---

## Security Considerations

1. **Authentication:** All endpoints require valid JWT authentication
2. **Authorization:** Only users with ADMIN role can access report endpoints
3. **File Access:** Reports are stored with UUID-based job IDs to prevent enumeration
4. **Automatic Cleanup:** Files are automatically deleted after 24 hours
5. **Date Validation:** End dates cannot be in the future to prevent data leakage

---

## Performance Considerations

1. **Async Processing:** Large reports are processed in background jobs
2. **Streaming:** Files are streamed to clients to reduce memory usage
3. **Indexing:** Database indexes on status, requestedBy, and expiresAt fields
4. **Cleanup:** Hourly cron job removes expired reports

---

## Future Enhancements

- [ ] Add support for email delivery of completed reports
- [ ] Implement report templates and custom filters
- [ ] Add pagination for large datasets
- [ ] Support for compressed (ZIP) downloads
- [ ] Report scheduling UI
- [ ] S3/cloud storage integration
- [ ] Report sharing with expiring links
- [ ] Webhook notifications on completion
