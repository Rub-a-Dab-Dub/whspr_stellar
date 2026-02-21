# Security Alerts & Anomaly Detection System

A comprehensive NestJS-based security monitoring system for automated detection of suspicious platform activity with real-time alerting.

## Features

- **Automated Anomaly Detection**: Bull cron jobs running every 10 minutes to detect suspicious activities
- **Rule-Based Detection**:
  - Spam detection (>100 messages in 1 minute)
  - Wash trading detection (>10 tips in 5 minutes from different senders)
  - Early withdrawal detection (withdrawal within 1 hour of registration)
  - IP-based registration fraud (>5 accounts from same IP in 24 hours)
  - Admin login anomalies (login from new IP addresses)

- **Security Alert Management**:
  - Alert severity levels: low, medium, high, critical
  - Status tracking: open, acknowledged, resolved
  - Detailed alert history and notes
- **Real-Time Notifications**: WebSocket events for high/critical alerts to connected admins

- **Access Control**:
  - ADMIN role: view and acknowledge alerts
  - SUPER_ADMIN role: configure rules and resolve alerts

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis (for Bull queue)

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Update environment variables with your database and Redis credentials.

## Running the Application

### Development

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

## Database Setup

```bash
# Run migrations
npm run migration:run
```

## API Endpoints

### Security Alerts Management (Admin only)

**List Alerts**

```http
GET /admin/security/alerts?severity=high&status=open
Authorization: Bearer <token>
```

Query Parameters:

- `severity`: Filter by severity (low, medium, high, critical)
- `status`: Filter by status (open, acknowledged, resolved)
- `page`: Pagination page number (default: 1)
- `limit`: Items per page (default: 20)

**Update Alert Status**

```http
PATCH /admin/security/alerts/:alertId
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "acknowledged",
  "note": "Investigating this alert"
}
```

## WebSocket Events

Connected admin users receive real-time notifications for high/critical severity alerts:

```json
{
  "event": "security.alert",
  "data": {
    "id": "alert-id",
    "severity": "critical",
    "rule": "spam",
    "details": {...},
    "createdAt": "2026-02-21T10:00:00Z"
  }
}
```

## Anomaly Rules

### 1. Spam Detection

- Threshold: >100 messages in 1 minute
- Severity: Medium

### 2. Wash Trading Detection

- Threshold: >10 tips in 5 minutes from different senders
- Severity: High

### 3. Early Withdrawal

- Threshold: Withdrawal within 1 hour of registration
- Severity: High

### 4. IP Registration Fraud

- Threshold: >5 accounts registered from same IP in 24 hours
- Severity: Medium

### 5. Admin Login Anomaly

- Threshold: Login from new/unrecognized IP
- Severity: Critical

## Project Structure

```
src/
├── modules/
│   └── security-alerts/
│       ├── controllers/      # API endpoints
│       ├── services/         # Business logic
│       ├── entities/         # Database models
│       └── gateways/         # WebSocket gateway
├── shared/
│   ├── guards/              # Authentication/Authorization
│   └── decorators/          # Custom decorators
├── database/                # Migrations and configurations
└── main.ts                  # Application entry point
```

## Development

### Running Tests

```bash
npm run test
npm run test:watch
npm run test:cov
```

### Code Style

```bash
npm run lint
npm run format
```

## Security Considerations

- All endpoints require JWT authentication
- Alert viewing restricted to ADMIN+ roles
- Alert configuration restricted to SUPER_ADMIN role
- Sensitive data (details) stored as JSONB for audit trails
- WebSocket connections require authenticated users

## License

MIT
