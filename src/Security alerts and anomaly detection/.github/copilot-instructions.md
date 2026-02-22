# Security Alerts & Anomaly Detection System - Copilot Instructions

## Project Overview

This is a NestJS-based security monitoring system that automatically detects suspicious platform activity and alerts administrators in real-time. The system implements 5 anomaly detection rules with configurable severity levels and uses Bull/Redis for scheduled job processing.

## Architecture

- **Framework**: NestJS with TypeORM for PostgreSQL
- **Queue**: Bull (Redis-backed) for async job processing
- **Real-time**: Socket.io WebSocket for admin notifications
- **Scheduling**: NestJS @Cron for every 10-minute anomaly checks
- **Authentication**: JWT with role-based access control

## Key Components

### Core Services

1. **SecurityAlertService** (`src/modules/security-alerts/services/security-alert.service.ts`)
   - Creates, retrieves, and updates security alerts
   - Manages alert status transitions (open → acknowledged → resolved)
   - Provides filtering and pagination

2. **AnomalyDetectionService** (`src/modules/security-alerts/services/anomaly-detection.service.ts`)
   - Implements 5 anomaly detection rules:
     - Spam: >100 messages in 1 minute
     - Wash Trading: >10 tips from different senders in 5 minutes
     - Early Withdrawal: withdrawal within 1 hour of registration
     - IP Registration Fraud: >5 accounts from same IP in 24 hours
     - Admin New IP: login from unrecognized IP (critical)
   - Rules are configurable via `updateRule()` method

3. **AnomalyCheckJobService** (`src/modules/security-alerts/services/anomaly-check-job.service.ts`)
   - Cron job running every 10 minutes
   - Queues anomaly detection jobs to Bull
   - Orchestrates data collection and rule checking

### API & WebSocket

4. **SecurityAlertsController** - REST endpoints
   - GET /admin/security/alerts - List with filtering
   - GET /admin/security/alerts/:alertId - Get specific alert
   - PATCH /admin/security/alerts/:alertId - Update status/notes
   - Requires ADMIN+ role

5. **SecurityAlertsGateway** - WebSocket
   - Namespace: /security
   - Event: security.alert (for high/critical only)
   - Authenticated connections only

### Guards & Decorators

- `JwtGuard` - Validates JWT tokens
- `RoleGuard` - Checks user roles
- `@Roles()` - Decorator to require specific roles
- `@CurrentUser()` - Injects current user object

## Database

- **Entity**: SecurityAlert (src/modules/security-alerts/entities/security-alert.entity.ts)
- **Field**: JSONB for flexible alert details
- **Status**: open | acknowledged | resolved
- **Severity**: low | medium | high | critical
- **Indexes**: (severity, status), (rule), (createdAt), (userId)

## Integration Point

To integrate with existing services update `DataIntegrationService` with actual queries:

- `getRecentMessages()` - fetch from message service
- `getRecentTips()` - fetch from tip service
- `getRecentRegistrations()` - fetch from user service
- `getNewUserWithdrawals()` - fetch from withdrawal service
- `getAdminLogins()` - fetch from auth service

## Configuration

Rules are configured in `AnomalyDetectionService` constructor:

- threshold: number of occurrences
- timeWindow: milliseconds
- severity: low | medium | high | critical
- enabled: boolean toggle

Can be updated at runtime via `updateRule(ruleName, config)`.

## Customization

1. **Add new rule**: Create check method in AnomalyDetectionService, call from processAnomalyCheck()
2. **Change schedule**: Modify @Cron expression in AnomalyCheckJobService (currently '_/10 _ \* \* \*')
3. **Adjust thresholds**: Call updateRule() at startup or via new admin endpoint

## Documentation Files

- **README.md** - Project overview
- **ARCHITECTURE.md** - Detailed system design
- **API_DOCUMENTATION.md** - Complete API specs with examples
- **INTEGRATION_GUIDE.md** - How to integrate with existing modules
- **RULES_CONFIGURATION.md** - Rule configuration details
- **DEPLOYMENT.md** - Production deployment guide
- **IMPLEMENTATION_SUMMARY.md** - Feature checklist and status

## Testing

- Unit tests in \*.spec.ts files
- Run with: `npm run test`
- Example test: `anomaly-detection.service.spec.ts`

## Running the Application

```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod

# With Docker
docker-compose up

# Run migrations
npm run migration:run
```

## Important Notes

- WebSocket events only emit for high/critical severity
- Only SUPER_ADMIN can resolve alerts
- All endpoints require JWT token in Authorization header
- Database uses PostgreSQL with TypeORM
- Redis required for Bull queue
- JSONB column stores rule-specific alert details

## File Locations by Purpose

- **Services**: src/modules/security-alerts/services/
- **Controllers**: src/modules/security-alerts/controllers/
- **Entities**: src/modules/security-alerts/entities/
- **WebSocket**: src/modules/security-alerts/gateways/
- **Guards**: src/shared/guards/
- **Decorators**: src/shared/decorators/
- **Migrations**: src/database/migrations/

## Key Concepts

- **Severity Levels**: Controls alert visibility and WebSocket emission
- **Alert Status**: Tracks investigation progress
- **Rule Flexibility**: JSONB details field supports any rule implementation
- **Sliding Windows**: Time-based detection using sorted timestamps
- **Horizontal Task**: Multiple app instances share Redis queue

---

Last Updated: 2026-02-21
