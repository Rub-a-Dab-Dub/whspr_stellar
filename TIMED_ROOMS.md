# Timed Rooms Feature

## Overview
Ephemeral timed rooms that auto-delete after a specified duration with message archiving and expiration notifications.

## API Endpoints

### Create Timed Room
```http
POST /rooms
Authorization: Bearer <token>

{
  "name": "Quick Chat",
  "roomType": "TIMED",
  "durationMinutes": 120
}
```

### Extend Room
```http
POST /rooms/:id/extend
Authorization: Bearer <token>

{
  "additionalMinutes": 60
}
```

### Get Countdown
```http
GET /rooms/:id/countdown
```

Response:
```json
{
  "expiryTimestamp": 1700000000000,
  "timeLeftMs": 3600000
}
```

### Get Analytics
```http
GET /rooms/analytics/expiration
```

## Features

✅ Duration validation (1 hour - 30 days)
✅ Auto-deletion at expiry
✅ Warning notifications (1 hour before)
✅ Message archiving before deletion
✅ Room extension functionality
✅ Countdown display
✅ Expiration analytics
✅ Scheduled cleanup job (every 10 minutes)

## Database Schema

### Room Entity Fields
- `expiryTimestamp`: Expiration time in milliseconds
- `durationMinutes`: Original duration
- `isExpired`: Expiration flag
- `warningNotificationSent`: Warning sent flag
- `extensionCount`: Number of extensions

### Archived Messages
- Stored in `archived_messages` table
- Includes original message data and metadata
- Indexed by roomId and archivedAt

## Background Jobs

### Room Expiration Processor
- Queue: `room-expiration`
- Runs every 10 minutes
- Sends warnings 1 hour before expiry
- Archives messages and deletes expired rooms

## Testing

```bash
npm run test -- room-expiration.service.spec.ts
```
