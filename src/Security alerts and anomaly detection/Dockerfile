# Docker Setup
# ============

FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create .env file from environment variables
ENV DATABASE_HOST=postgres \
    DATABASE_PORT=5432 \
    DATABASE_USER=postgres \
    DATABASE_PASSWORD=postgres \
    DATABASE_NAME=security_alerts \
    REDIS_HOST=redis \
    REDIS_PORT=6379 \
    NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/main"]
