# ARCHITECTURE DOCUMENTATION

## System Overview

The Security Alerts & Anomaly Detection system is a real-time monitoring solution built with NestJS that automatically detects suspicious platform activity and alerts administrators.

```
┌─────────────────────────────────────────────────────────────┐
│                   External Events                            │
│   (Messages, Tips, Registrations, Withdrawals, Logins)      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Integration Points                          │
│   - Message Service                                          │
│   - Tips Service                                             │
│   - User/Registration Service                               │
│   - Withdrawal Service                                       │
│   - Authentication/Admin Login Service                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          Anomaly Check Job Service                           │
│   - Runs every 10 minutes via @Cron decorator               │
│   - Queues jobs to Bull for processing                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│             Bull Queue (Redis-backed)                        │
│   - Job queue for async processing                          │
│   - Ensures reliable job execution                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Anomaly Detection Service                            │
│                                                              │
│  Rule Processors:                                           │
│  1. Spam Detection                                          │
│  2. Wash Trading Detection                                  │
│  3. Early Withdrawal Detection                              │
│  4. IP Registration Fraud Detection                         │
│  5. Admin New IP Login Detection                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│        Security Alert Service                               │
│   - Creates SecurityAlert entities                          │
│   - Saves to PostgreSQL database                            │
│   - Emits WebSocket events (high/critical)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Database      WebSocket        Admin API
   (PostgreSQL)   Gateway         Controller
```

## Core Components

### 1. Security Alert Entity

**File:** `src/modules/security-alerts/entities/security-alert.entity.ts`

Represents a detected anomaly with the following properties:

- `id`: UUID primary key
- `rule`: Alert rule that triggered (enum)
- `severity`: Alert level (low, medium, high, critical)
- `status`: Current state (open, acknowledged, resolved)
- `userId`: Optional user involved in the anomaly
- `adminId`: Optional admin involved (for login anomalies)
- `details`: JSONB field for rule-specific data
- `note`: Admin notes and investigation details
- Timestamps: created, updated, acknowledged, resolved

**Database:** PostgreSQL with indexes on severity, status, rule, and createdAt for fast queries.

### 2. Anomaly Detection Service

**File:** `src/modules/security-alerts/services/anomaly-detection.service.ts`

Core business logic for detecting five types of anomalies:

#### Rule Implementations:

**Spam Detection**

- Algorithm: Sliding window per user
- Threshold: >100 messages in 1 minute
- Method: Analyzes message timestamps and counts

**Wash Trading Detection**

- Algorithm: Unique sender counting
- Threshold: >10 unique senders in 5 minutes
- Method: Groups tips by recipient, counts unique senders

**Early Withdrawal Detection**

- Algorithm: Time difference check
- Threshold: Withdrawal within 1 hour of registration
- Method: Compares registration and withdrawal timestamps

**IP Registration Fraud Detection**

- Algorithm: IP-based grouping with sliding window
- Threshold: >5 accounts from same IP in 24 hours
- Method: Groups registrations by IP, counts within time window

**Admin New IP Login Detection**

- Algorithm: IP history check
- Threshold: Any new/unrecognized IP
- Method: Compares login IP against historical admin logins
- Severity: Critical (highest)

### 3. Anomaly Check Job Service

**File:** `src/modules/security-alerts/services/anomaly-check-job.service.ts`

Cron-based job scheduler:

- **Schedule:** Every 10 minutes (`*/10 * * * *`)
- **Function:** Triggers data collection and anomaly checks
- **Mechanism:** Queues jobs to Bull/Redis for reliable async processing
- **Extensibility:** Can be modified to support custom schedules per rule

### 4. Security Alerts Gateway (WebSocket)

**File:** `src/modules/security-alerts/gateways/security-alerts.gateway.ts`

Real-time notification system:

- **Namespace:** `/security`
- **Authentication:** Validates user ID and ADMIN/SUPER_ADMIN role
- **Emissions:** High/critical severity alerts only
- **Clients:** Connected admin users
- **Event:** `security.alert` with full alert payload

### 5. Security Alerts Controller

**File:** `src/modules/security-alerts/controllers/security-alerts.controller.ts`

REST API endpoints:

- `GET /admin/security/alerts` - List alerts with filtering
- `GET /admin/security/alerts/:alertId` - Get specific alert
- `PATCH /admin/security/alerts/:alertId` - Update alert status/notes

**Access Control:**

- ADMIN: View and acknowledge alerts
- SUPER_ADMIN: View, acknowledge, and resolve alerts

### 6. Security Alerts Module

**File:** `src/modules/security-alerts/security-alerts.module.ts`

Integrates all components:

- Registers entities with TypeORM
- Configures Bull queue
- Enables NestJS scheduling
- Exports services for use in other modules

## Data Flow

### 1. Alert Creation Flow

```
User Activity (Message, Tip, etc.)
    ↓
Anomaly Detection Service
    ├─ Analyzes activity against rule thresholds
    ├─ Creates alert record if threshold exceeded
    └─ Emits to WebSocket (if high/critical)
    ↓
Database (PostgreSQL)
    ↓
Available via REST API & WebSocket
```

### 2. Cron Job Flow

```
Every 10 minutes:
    ↓
Cron Job Triggers
    ↓
Queue Job to Bull/Redis
    ↓
Process Anomaly Check (async)
    ├─ Fetch recent data from integrations
    ├─ Run all enabled rule checks
    └─ Create alerts as needed
    ↓
WebSocket Broadcast (high/critical only)
```

### 3. Admin Alert Management Flow

```
Admin Views Alerts
    ↓
GET /admin/security/alerts
    ├─ Auth checks (JWT validation)
    ├─ Role checks (ADMIN+ required)
    └─ Returns filtered alert list
    ↓
Admin Updates Alert
    ↓
PATCH /admin/security/alerts/:alertId
    ├─ Validates status transition
    ├─ Adds investigation notes
    └─ Updates timestamps
    ↓
Alert marked as acknowledged/resolved
```

## Database Schema

### security_alerts Table

```sql
CREATE TABLE security_alerts (
  id UUID PRIMARY KEY,
  rule VARCHAR(50),
  severity VARCHAR(20),
  status VARCHAR(20),
  userId UUID NULLABLE,
  adminId UUID NULLABLE,
  details JSONB NULLABLE,
  note TEXT NULLABLE,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  acknowledgedAt TIMESTAMP NULLABLE,
  resolvedAt TIMESTAMP NULLABLE
);

-- Indexes for performance
CREATE INDEX idx_severity_status ON security_alerts(severity, status);
CREATE INDEX idx_rule ON security_alerts(rule);
CREATE INDEX idx_createdAt ON security_alerts(createdAt);
CREATE INDEX idx_userId ON security_alerts(userId)
  WHERE userId IS NOT NULL;
```

## Security Considerations

### 1. Authentication & Authorization

- JWT-based authentication on all endpoints
- Role-based access control (RBAC)
- SUPER_ADMIN required for sensitive operations (resolve alerts)

### 2. Data Protection

- JSONB column for flexible, auditable alert details
- All alert data retained for forensic analysis
- Sensitive data should be encrypted at rest

### 3. WebSocket Security

- Token-based authentication in WebSocket connection
- Role validation before accepting connection
- Only high/critical alerts broadcast (avoid info leakage)

### 4. Rate Limiting

Currently not implemented. Recommend adding:

- Per-user API rate limiting
- IP-based global rate limiting

## Scalability Considerations

### 1. Database

- Indexes on frequently queried columns (severity, status, rule)
- Can partition alert table by date if needed
- PostgreSQL JSONB provides flexible query capability

### 2. Message Queue

- Bull/Redis for reliable job processing
- Scales horizontally with multiple job processors
- Survives application restarts

### 3. WebSocket

- Socket.io manages connection pooling
- Can scale to multiple app instances with Redis adapter
- Consider implementing reconnection with exponential backoff

### 4. Anomaly Detection

- Stateless service, can be scaled horizontally
- Rule execution is independent
- Data fetching is the bottleneck (optimize queries)

## Integration Points

Applications must implement:

1. **Data Fetching**
   - `messageService.getRecentMessages(userId?, minutesBack)`
   - `tipService.getRecentTips(minutesBack)`
   - `userService.getNewUserWithdrawals(hoursBack)`
   - `userService.getRecentRegistrations(hoursBack)`
   - `authService.getAdminLogins(hoursBack)`

2. **WebSocket Integration**
   - Connect from frontend with userId and role
   - Listen for `security.alert` events
   - Update admin dashboard/UI in real-time

3. **Alert Emission**
   - After creating alerts, emit to WebSocket:
   ```typescript
   await this.anomalyDetectionService.checkSpamRule(messages);
   const alerts = await this.alertService.getAlerts({ status: 'open' });
   alerts.forEach((alert) => this.gateway.emitSecurityAlert(alert));
   ```

## Configuration & Customization

### Rule Configuration

Edit rules via `AnomalyDetectionService.updateRule()`:

```typescript
anomalyDetectionService.updateRule('spam', {
  threshold: 200,
  severity: 'high',
  timeWindow: 120000,
});
```

### Schedule Customization

Modify cron expression in `AnomalyCheckJobService`:

```typescript
@Cron('*/5 * * * *')  // Run every 5 minutes instead
```

### Severity Mapping

Update severity levels in
`SecurityAlert` entity enum and rule configs.

## Monitoring & Observability

### Key Metrics to Monitor

1. **Alert Creation Rate**: Alerts per minute
2. **Rule Accuracy**: False positive/negative ratios
3. **Processing Latency**: Time from detection to alert creation
4. **Queue Depth**: Bull queue job backlog
5. **WebSocket Connections**: Active admin connections
6. **Database Query Performance**: Alert retrieval times

### Logging

- NestJS Logger configured in each service
- Log levels: error, warn, log, debug, verbose
- Structure logs with context information

### Alerting

Consider implementing alerts for:

- Queue processing failures
- Database connectivity issues
- Rapid spike in anomaly detections
- WebSocket connection failures

export default {};
