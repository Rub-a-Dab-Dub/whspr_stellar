# Deployment Guide

This guide covers deploying the Admin Audit Log Service to production.

## Prerequisites

- Docker & Docker Compose
- Node.js 18+
- PostgreSQL 12+ (for production)
- Kubernetes (optional, for k8s deployment)

## Local Development Deployment

### Using Docker Compose

1. **Start PostgreSQL**

```bash
docker-compose up -d
```

2. **Verify Database Connection**

```bash
docker-compose ps
docker logs admin_audit_log_postgres
```

3. **Install Dependencies**

```bash
npm install
```

4. **Run Migrations**

```bash
npm run build
npm run typeorm migration:run -- -d src/database/data-source.ts
```

5. **Start the Application**

```bash
npm run start:dev
```

## Production Deployment

### Environment Setup

1. **Create Production Environment File**

```bash
cp .env.example .env.production
```

2. **Configure Production Variables**

```env
DB_HOST=prod-db-server.example.com
DB_PORT=5432
DB_USERNAME=audit_log_user
DB_PASSWORD=<SECURE_PASSWORD>
DB_DATABASE=admin_audit_log_production
DB_LOGGING=false

PORT=3000
NODE_ENV=production
```

3. **Use Secrets Management**

```bash
# Use environment variable directly or secrets manager
export DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id admin-audit-db-password --query SecretString --output text)
```

### Build for Production

```bash
# Install dependencies
npm ci --only=production

# Build TypeScript
npm run build

# Verify build
ls -la dist/
```

### Docker Deployment

Create `Dockerfile.production`:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**Build Docker Image:**

```bash
docker build -f Dockerfile.production -t admin-audit-log-service:latest .
```

**Run Container:**

```bash
docker run -d \
  --name admin-audit-log \
  -e DB_HOST=postgres-server \
  -e DB_USERNAME=audit_log_user \
  -e DB_PASSWORD=secure_password \
  -e DB_DATABASE=admin_audit_log_production \
  -p 3000:3000 \
  admin-audit-log-service:latest
```

### Kubernetes Deployment

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: admin-audit-log-service
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: admin-audit-log
  template:
    metadata:
      labels:
        app: admin-audit-log
    spec:
      containers:
        - name: admin-audit-log
          image: admin-audit-log-service:latest
          ports:
            - containerPort: 3000
          env:
            - name: DB_HOST
              valueFrom:
                configMapKeyRef:
                  name: audit-log-config
                  key: db_host
            - name: DB_USERNAME
              valueFrom:
                secretKeyRef:
                  name: audit-log-secrets
                  key: db_username
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: audit-log-secrets
                  key: db_password
            - name: DB_DATABASE
              valueFrom:
                configMapKeyRef:
                  name: audit-log-config
                  key: db_database
            - name: NODE_ENV
              value: 'production'
            - name: PORT
              value: '3000'
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'

---
apiVersion: v1
kind: Service
metadata:
  name: admin-audit-log-service
spec:
  selector:
    app: admin-audit-log
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

**Deploy to Kubernetes:**

```bash
# Create ConfigMap
kubectl create configmap audit-log-config \
  --from-literal=db_host=postgres.default.svc.cluster.local \
  --from-literal=db_database=admin_audit_log_production

# Create Secrets
kubectl create secret generic audit-log-secrets \
  --from-literal=db_username=audit_log_user \
  --from-literal=db_password=$(SECURE_PASSWORD)

# Deploy
kubectl apply -f k8s-deployment.yaml

# Monitor
kubectl get pods -l app=admin-audit-log
kubectl logs -f deployment/admin-audit-log-service
```

## Database Migration

### Pre-Deployment Checks

1. **Backup Existing Database**

```bash
pg_dump -h $DB_HOST -U $DB_USERNAME $DB_DATABASE > backup_$(date +%Y%m%d).sql
```

2. **Test Migration on Staging**

```bash
NODE_ENV=staging npm run typeorm migration:run
```

3. **Verify Migration**

```sql
-- Connect to database
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE

-- Verify table exists
\d admin_audit_logs

-- Verify indexes
\d+ admin_audit_logs
```

### Deployment Migration

1. **Run Migration in Production**

```bash
NODE_ENV=production npm run typeorm migration:run
```

2. **Verify Production Data**

```bash
# Check if migration was successful
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c \
  "SELECT COUNT(*) FROM admin_audit_logs;"
```

## Health Checks

### Add Health Check Endpoint

```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
```

**Test Health Check:**

```bash
curl http://localhost:3000/health
```

## Monitoring & Logging

### Enable Query Logging

```env
DB_LOGGING=true
```

### Log Aggregation

Configure log forwarding:

```typescript
// src/main.ts
import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  );
}
```

### Metrics Collection

Add Prometheus metrics:

```bash
npm install @nestjs/metrics prom-client
```

```typescript
// src/app.module.ts
import { MetricsModule } from '@nestjs/metrics';

@Module({
  imports: [
    MetricsModule.forRoot(),
    // ... other imports
  ],
})
export class AppModule {}
```

Access metrics:

```
http://localhost:3000/metrics
```

## Performance Optimization

### Connection Pooling

```typescript
// app.module.ts
TypeOrmModule.forRoot({
  ...
  extra: {
    max: 20, // Maximum pool connections
    min: 5,  // Minimum pool connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
})
```

### Query Optimization

- All queries use indexed columns
- Pagination limits result sets
- Batch operations for bulk inserts

### Caching (Optional)

```typescript
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300, // 5 minutes
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

## Backup Strategy

### Automated Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/var/backups/admin-audit-logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/audit_logs_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

pg_dump \
  -h $DB_HOST \
  -U $DB_USERNAME \
  -d $DB_DATABASE \
  > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Upload to S3
aws s3 cp "$BACKUP_FILE.gz" "s3://backup-bucket/audit-logs/"

# Keep only last 30 days of backups
find $BACKUP_DIR -name "audit_logs_*.sql.gz" -mtime +30 -delete
```

**Schedule with Cron:**

```bash
# Run backup daily at 2 AM
0 2 * * * /backup.sh
```

## Disaster Recovery

### Restore from Backup

```bash
# List available backups
ls -la /var/backups/admin-audit-logs/

# Restore from specific backup
gunzip -c /var/backups/admin-audit-logs/audit_logs_20260221_020000.sql.gz \
  | psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE
```

### Recovery Verification

```sql
-- Check if recovery was successful
SELECT COUNT(*) as total_logs FROM admin_audit_logs;
SELECT MAX(createdAt) as latest_audit_log FROM admin_audit_logs;
```

## Load Testing

### Using Apache Bench

```bash
# Test health endpoint
ab -n 1000 -c 10 http://localhost:3000/health
```

### Using wrk

```bash
# Install wrk
brew install wrk # macOS
# or sudo apt-get install wrk # Linux

# Run load test
wrk -t4 -c100 -d30s http://localhost:3000/health
```

## Rate Limiting

Add rate limiting middleware:

```bash
npm install @nestjs/throttler
```

```typescript
// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10, // 10 requests per minute
    }),
  ],
})
export class AppModule {}
```

## Security Hardening

### SQL Injection Prevention

- ✅ Using TypeORM with parameterized queries (automatic)
- ✅ No raw SQL in critical paths

### DDOS Protection

- ✅ Rate limiting enabled
- ✅ Connection pooling limits
- ✅ Request timeout handling

### Data Encryption

- ✅ HTTPS enforced in production
- ✅ Database password in secrets manager
- ✅ Sensitive data in logs filtered

## Rollback Procedure

### In Case of Issues

1. **Check Application Logs**

```bash
kubectl logs -f deployment/admin-audit-log-service | tail -100
```

2. **Revert to Previous Version**

```bash
kubectl rollout history deployment/admin-audit-log-service
kubectl rollout undo deployment/admin-audit-log-service
```

3. **Restore Database from Backup**

```bash
# If needed
gunzip -c /var/backups/admin-audit-logs/audit_logs_$(date +%Y%m%d)_020000.sql.gz \
  | psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE
```

## Post-Deployment Verification

1. **Health Check**

```bash
curl -v http://localhost:3000/health
```

2. **Database Connectivity**

```bash
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c "SELECT 1;"
```

3. **Log Recent Entries**

```bash
docker logs admin-audit-log | head -50
```

4. **Performance Check**

```bash
ab -n 100 -c 10 http://localhost:3000/health
```

## Maintenance

### Regular Tasks

- **Weekly**: Review error logs
- **Bi-weekly**: Backup verification test
- **Monthly**: Performance analysis
- **Quarterly**: Security audit
- **Annually**: Disaster recovery drill

### Database Maintenance

```sql
-- Analyze query performance
ANALYZE admin_audit_logs;

-- Vacuum to reclaim space
VACUUM FULL admin_audit_logs;

-- Check index health
SELECT * FROM pg_stat_user_indexes WHERE relname = 'admin_audit_logs';
```

## Troubleshooting

### Connection Issues

```bash
# Test PostgreSQL connection
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c "SELECT 1;"

# Check connection pooling
SELECT count(*) FROM pg_stat_activity WHERE datname = 'admin_audit_log_production';
```

### Performance Issues

```sql
-- Find slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, indexname FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

## Support

For deployment issues, consult:

- NestJS Documentation: https://docs.nestjs.com
- TypeORM Documentation: https://typeorm.io
- PostgreSQL Documentation: https://www.postgresql.org/docs
