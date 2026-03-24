# Gasless Gossip Backend API

NestJS backend with TypeORM, PostgreSQL, and comprehensive production-ready features.

## Features

- ✅ NestJS with TypeScript strict mode
- ✅ TypeORM with PostgreSQL connection pooling
- ✅ Environment validation with Joi (fail-fast on startup)
- ✅ Global exception filter with structured error responses
- ✅ Global validation pipe with class-validator
- ✅ CORS, Helmet, Compression, Rate-limiting
- ✅ Swagger/OpenAPI documentation at `/api/docs`
- ✅ Structured logging with Winston
- ✅ Health check endpoints with database ping
- ✅ Jest unit and e2e tests
- ✅ Docker Compose for local development
- ✅ Database migrations with TypeORM CLI

## Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop (recommended) OR PostgreSQL 14+

### 1. Clone and Install

```bash
npm install
```

### 2. Start Database (Docker)

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis containers. Wait for them to be healthy:

```bash
docker-compose ps
```

### 3. Configure Environment

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_*`: Database connection (defaults work with Docker)
- `JWT_SECRET`: Must be at least 32 characters
- `EVM_*`: Your blockchain configuration

### 4. Run Migrations

```bash
npm run migration:run
```

### 5. Start Development Server

```bash
npm run start:dev
```

The API will be available at:
- API: http://localhost:3001/api
- Swagger Docs: http://localhost:3001/api/docs
- Health Check: http://localhost:3001/api/health

## Available Scripts

### Development
```bash
npm run start:dev      # Start with hot-reload
npm run start:debug    # Start with debugger
npm run start:prod     # Start production build
```

### Building
```bash
npm run build          # Build for production
```

### Testing
```bash
npm test               # Run unit tests
npm run test:watch     # Run tests in watch mode
npm run test:cov       # Run tests with coverage
npm run test:e2e       # Run e2e tests
```

### Database Migrations
```bash
npm run migration:generate -- src/migrations/MigrationName  # Generate migration
npm run migration:run                                        # Run migrations
npm run migration:revert                                     # Revert last migration
```

### Linting
```bash
npm run lint           # Lint and fix
npm run format         # Format with Prettier
```

### Docker
```bash
docker-compose up -d           # Start services
docker-compose down            # Stop services
docker-compose logs -f         # View logs
docker-compose down -v         # Stop and remove volumes
```

## Project Structure

```
src/
├── common/                 # Shared utilities
│   ├── dto/               # Common DTOs
│   └── filters/           # Exception filters
├── config/                # Configuration files
│   ├── env.validation.ts  # Joi validation schema
│   ├── typeorm.config.ts  # TypeORM configuration
│   └── winston.config.ts  # Winston logger config
├── health/                # Health check module
│   ├── health.controller.ts
│   └── health.module.ts
├── migrations/            # Database migrations
├── app.module.ts          # Root module
├── app.controller.ts      # Root controller
├── app.service.ts         # Root service
└── main.ts               # Application entry point
```

## API Documentation

Once the server is running, visit http://localhost:3001/api/docs for interactive Swagger documentation.

### Key Endpoints

- `GET /api` - API information
- `GET /api/health` - Full health check (database, memory, disk)
- `GET /api/health/ready` - Readiness probe (database only)
- `GET /api/health/live` - Liveness probe

## Environment Variables

### Required

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=gasless_gossip

# JWT (must be 32+ characters)
JWT_SECRET=your_jwt_secret_minimum_32_characters_long

# EVM
EVM_RPC_URL=https://your-rpc-url
EVM_PRIVATE_KEY=your-private-key
EVM_ACCOUNT_ADDRESS=your-account-address
EVM_CONTRACT_ADDRESS=your-contract-address
```

### Optional

```env
NODE_ENV=development
PORT=3001
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
JWT_EXPIRES_IN=7d
EVM_NETWORK=base
REDIS_HOST=localhost
REDIS_PORT=6379
THROTTLE_TTL=60
THROTTLE_LIMIT=10
CORS_ORIGIN=http://localhost:3000
```

## Error Handling

All errors return a consistent JSON structure:

```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint",
  "method": "POST",
  "message": "Validation failed",
  "error": "Bad Request"
}
```

In development mode, stack traces are included.

## Validation

All request DTOs are automatically validated using class-validator. Invalid requests return 400 with detailed error messages.

Example:
```typescript
import { IsString, IsEmail, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsEmail()
  email: string;
}
```

## Database Migrations

### Creating a Migration

1. Make changes to your entities
2. Generate migration:
```bash
npm run migration:generate -- src/migrations/AddUserTable
```

3. Review the generated migration file
4. Run migration:
```bash
npm run migration:run
```

### Migration Best Practices

- Always review generated migrations before running
- Test migrations in development first
- Keep migrations small and focused
- Never modify existing migrations that have been deployed

## Testing

### Unit Tests

```bash
npm test
```

Tests are located next to the files they test (e.g., `app.service.spec.ts`).

### E2E Tests

```bash
npm run test:e2e
```

E2E tests are in the `test/` directory and test the full application flow.

### Coverage

```bash
npm run test:cov
```

Coverage reports are generated in the `coverage/` directory.

## Logging

Winston is configured with:
- Console output (colorized in development)
- File output: `logs/error.log` (errors only)
- File output: `logs/combined.log` (all logs)

Log levels: error, warn, info, debug

## Security Features

- **Helmet**: Sets security-related HTTP headers
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: Throttle requests (10 per minute by default)
- **Validation**: Automatic request validation and sanitization
- **Environment Validation**: Fail-fast on missing/invalid env vars

## Production Deployment

### Using Docker

```bash
# Build image
docker build -t gasless-gossip-api .

# Run container
docker run -p 3001:3001 --env-file .env gasless-gossip-api
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET` (32+ characters)
3. Configure production database
4. Set appropriate `CORS_ORIGIN`
5. Review rate limiting settings
6. Enable HTTPS/TLS

### Health Checks

Configure your orchestrator (Kubernetes, ECS, etc.) to use:
- Liveness: `GET /api/health/live`
- Readiness: `GET /api/health/ready`

## Troubleshooting

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres

# Restart services
docker-compose restart
```

### Environment Validation Failed

The app will fail to start if required environment variables are missing or invalid. Check the error message for details.

### Port Already in Use

```bash
# Change PORT in .env
PORT=3002

# Or kill the process using the port
lsof -ti:3001 | xargs kill -9
```

### Migration Failed

```bash
# Revert last migration
npm run migration:revert

# Check database state
docker-compose exec postgres psql -U postgres -d gasless_gossip -c "\dt"
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Run linting: `npm run lint`
5. Run tests: `npm test`
6. Submit a pull request

## License

MIT
