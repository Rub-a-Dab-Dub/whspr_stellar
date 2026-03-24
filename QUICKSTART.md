# Quick Start Guide

Get the Gasless Gossip backend running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Docker Desktop (or PostgreSQL 14+ installed locally)

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Verify Setup

```bash
npm run verify
```

This checks that everything is configured correctly.

### 3. Start Database

**Option A: Using Docker (Recommended)**

```bash
# If you have Docker without sudo
docker-compose up -d

# If you need sudo for Docker
sudo docker-compose up -d
```

**Option B: Using Local PostgreSQL**

Make sure PostgreSQL is running and update `.env` with your connection details.

### 4. Run Database Migrations

```bash
npm run migration:run
```

### 5. Start Development Server

```bash
npm run start:dev
```

## Verify It's Working

Open your browser:

- API Info: http://localhost:3001/api
- Swagger Docs: http://localhost:3001/api/docs
- Health Check: http://localhost:3001/api/health

You should see the API responding!

## What's Configured?

✅ NestJS with TypeScript strict mode  
✅ TypeORM with PostgreSQL  
✅ Environment validation (Joi)  
✅ Global exception filter  
✅ Global validation pipe  
✅ CORS, Helmet, Compression, Rate-limiting  
✅ Swagger/OpenAPI docs at `/api/docs`  
✅ Winston logging  
✅ Health check endpoints  
✅ Jest tests (unit + e2e)  
✅ Docker Compose setup  
✅ Database migrations  

## Common Commands

```bash
# Development
npm run start:dev          # Start with hot-reload
npm run start:debug        # Start with debugger

# Testing
npm test                   # Run unit tests
npm run test:e2e          # Run e2e tests
npm run test:cov          # Run with coverage

# Database
npm run migration:generate -- src/migrations/MyMigration
npm run migration:run
npm run migration:revert

# Docker
npm run docker:up         # Start services
npm run docker:down       # Stop services
npm run docker:logs       # View logs
npm run docker:clean      # Remove all data

# Build
npm run build             # Build for production
npm run lint              # Lint code
npm run format            # Format code
```

## Troubleshooting

### Port 3001 already in use

```bash
# Change PORT in .env
PORT=3002
```

### Docker permission denied

```bash
# Use sudo
sudo docker-compose up -d

# Or add your user to docker group (Linux)
sudo usermod -aG docker $USER
newgrp docker
```

### Database connection failed

```bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres

# Restart
docker-compose restart postgres
```

### Environment validation failed

Check that all required variables in `.env` are set:
- `JWT_SECRET` must be at least 32 characters
- All `DATABASE_*` variables must be set
- All `EVM_*` variables must be set

## Next Steps

1. Read the full [README.backend.md](./README.backend.md) for detailed documentation
2. Check out the Swagger docs at http://localhost:3001/api/docs
3. Start building your features!

## Need Help?

- Check the logs: `docker-compose logs -f`
- Run verification: `npm run verify`
- See full docs: [README.backend.md](./README.backend.md)
