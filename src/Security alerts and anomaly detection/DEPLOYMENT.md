# DEPLOYMENT GUIDE

## Local Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis 7.0+

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env
# Edit .env with your database and Redis credentials
```

### Step 3: Set Up Database

```bash
# Create database (if not exists)
createdb security_alerts

# Run migrations
npm run migration:run
```

### Step 4: Start Redis

```bash
# If using Docker:
docker run -d -p 6379:6379 redis:7.0-alpine

# Or locally:
redis-server
```

### Step 5: Run Application

```bash
npm run start:dev
```

Server will be available at `http://localhost:3000`

---

## Docker Compose Deployment

### Quick Start

```bash
# Build and start all services
docker-compose up

# Run in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f app
```

This starts:

- PostgreSQL (port 5432)
- Redis (port 6379)
- NestJS App (port 3000)

### Configuration

Edit `docker-compose.yml` to change:

- Database credentials
- Redis configuration
- Application port
- Environment variables

---

## Production Deployment

### 1. Build Docker Image

```bash
docker build -t security-alerts:latest .
```

### 2. Push to Registry

```bash
docker tag security-alerts:latest your-registry/security-alerts:latest
docker push your-registry/security-alerts:latest
```

### 3. Environment Variables

Set in production:

```env
DATABASE_HOST=prod-db-host
DATABASE_USER=prod-user
DATABASE_PASSWORD=<strong-password>
DATABASE_NAME=security_alerts
REDIS_HOST=prod-redis-host
REDIS_PORT=6379
JWT_SECRET=<very-strong-secret>
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com
WS_CORS_ORIGIN=https://yourdomain.com
```

### 4. Database Migration

Run on deployment:

```bash
npm run migration:run
```

### 5. Run Container

```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_HOST=${DB_HOST} \
  -e DATABASE_USER=${DB_USER} \
  -e DATABASE_PASSWORD=${DB_PASS} \
  -e REDIS_HOST=${REDIS_HOST} \
  -e JWT_SECRET=${JWT_SECRET} \
  -e NODE_ENV=production \
  --name security-alerts \
  your-registry/security-alerts:latest
```

---

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl create namespace security
```

### 2. Create Secrets

```bash
kubectl create secret generic db-credentials \
  --from-literal=username=postgres \
  --from-literal=password=secure-password \
  -n security

kubectl create secret generic jwt-secret \
  --from-literal=secret=your-jwt-secret \
  -n security
```

### 3. Apply Manifests

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: security-alerts
  namespace: security
spec:
  replicas: 3
  selector:
    matchLabels:
      app: security-alerts
  template:
    metadata:
      labels:
        app: security-alerts
    spec:
      containers:
        - name: app
          image: your-registry/security-alerts:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_HOST
              value: postgres.security.svc.cluster.local
            - name: REDIS_HOST
              value: redis.security.svc.cluster.local
            - name: DATABASE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: password
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: jwt-secret
                  key: secret
            - name: NODE_ENV
              value: production
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: security-alerts
  namespace: security
spec:
  selector:
    app: security-alerts
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

Apply:

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
```

---

## Performance Tuning

### Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM security_alerts
  WHERE severity = 'critical' AND status = 'open';

-- Create additional indexes if needed
CREATE INDEX idx_custom ON security_alerts(userId, createdAt DESC);
```

### Redis Optimization

```bash
# Check Redis memory usage
redis-cli INFO memory

# Set max memory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### NestJS Optimization

```typescript
// Enable clustering
import * as cluster from 'cluster';
import * as os from 'os';

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Start application
}
```

---

## Monitoring & Logging

### Health Check Endpoint

Add to your controller:

```typescript
@Get('/health')
health() {
  return { status: 'ok', timestamp: new Date() };
}
```

### Application Logging

Configure Winston or Pino:

```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger('MyService');
logger.log('Application started');
logger.warn('Warning message');
logger.error('Error message', stack);
```

### Metrics Collection

Implement with Prometheus:

```typescript
// Install: npm install @nestjs/metrics prom-client

import { PrometheusModule } from '@nestjs/metrics/prometheus';

@Module({
  imports: [PrometheusModule.register()],
})
export class AppModule {}
```

---

## Backup & Recovery

### Database Backup

```bash
# Full backup
pg_dump -U postgres security_alerts > backup.sql

# Restore
psql -U postgres security_alerts < backup.sql

# Automated daily backups
0 2 * * * pg_dump -U postgres security_alerts > /backups/db_$(date +\%Y\%m\%d).sql
```

### Redis Backup

```bash
# Redis has built-in persistence (RDB, AOF)
# Enable in redis.conf:
# save 900 1
# save 300 10
# appendonly yes
```

---

## Scaling Strategy

### Horizontal Scaling

1. Run multiple app instances (3+ for HA)
2. Use load balancer (nginx, HAProxy, or cloud LB)
3. Use Redis adapter for Socket.io state sharing

### Vertical Scaling

1. Increase CPU/memory allocation
2. Optimize database queries
3. Implement caching layer (Redis for repeated queries)

### Database Scaling

1. Read replicas for reporting
2. Connection pooling (PgBouncer)
3. Partitioning alerts table by date

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql -h localhost -U postgres -d security_alerts

# Check logs
tail -f /var/log/postgresql/postgresql.log
```

### Redis Connection Issues

```bash
# Test connection
redis-cli ping

# Check status
redis-cli INFO server
```

### WebSocket Connection Issues

- Check CORS configuration
- Verify firewall allows WebSocket
- Ensure client sends valid userId and role
- Check browser console for connection errors

---

## Maintenance

### Regular Tasks

- Monitor disk space
- Check database index health
- Review and update rule configurations
- Analyze alert patterns for tuning

### Security Updates

```bash
# Update dependencies
npm audit
npm update

# Update Docker images
docker pull node:18-alpine
docker pull postgres:15-alpine
docker pull redis:7.0-alpine
```

---

## Rollback Procedure

```bash
# Keep previous image tags
docker tag security-alerts:latest security-alerts:previous

# If deployment fails, revert to previous
kubectl set image deployment/security-alerts \
  app=your-registry/security-alerts:previous \
  -n security

# Or with Docker Compose
docker-compose down
git checkout previous-version
docker-compose up -d
```

export default {};
