#!/bin/bash

# E2E Test Setup Script
# Sets up the test database, runs migrations, seeds data, and optionally runs tests
# This script is idempotent - safe to run multiple times

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
TEST_DB_NAME="${DATABASE_NAME_TEST:-gasless_test}"
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_USER="${DATABASE_USER:-postgres}"

echo -e "${BLUE}🚀 E2E Test Environment Setup${NC}\n"

# Check if PostgreSQL is running
echo -e "${YELLOW}📍 Checking PostgreSQL connection...${NC}"
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
  echo -e "${RED}❌ PostgreSQL is not running on $DB_HOST:$DB_PORT${NC}"
  echo "Please start PostgreSQL and try again."
  exit 1
fi
echo -e "${GREEN}✅ PostgreSQL is running${NC}\n"

# Create test database if it doesn't exist
echo -e "${YELLOW}📍 Creating test database '$TEST_DB_NAME'...${NC}"
PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
  -tc "SELECT 1 FROM pg_database WHERE datname = '$TEST_DB_NAME'" | grep -q 1 || \
  PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
  -c "CREATE DATABASE $TEST_DB_NAME"
echo -e "${GREEN}✅ Test database ready${NC}\n"

# Run migrations against test database
echo -e "${YELLOW}📍 Running migrations on test database...${NC}"
NODE_ENV=test npm run migration:run:test
echo -e "${GREEN}✅ Migrations completed${NC}\n"

# Seed test data
echo -e "${YELLOW}📍 Seeding test data...${NC}"
NODE_ENV=test npm run seed:test
echo -e "${GREEN}✅ Test data seeded${NC}\n"

echo -e "${GREEN}✨ Setup complete!${NC}"
echo -e "\n${BLUE}📝 Test Database Summary:${NC}"
echo "   Database: $TEST_DB_NAME"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   User: $DB_USER"
echo ""
echo -e "${BLUE}🧪 Run tests with:${NC}"
echo "   npm run test:e2e:admin          # Run only admin e2e tests"
echo "   npm run test:e2e                # Run all e2e tests"
echo ""

# Run tests if --with-tests flag is provided
if [ "$1" = "--with-tests" ]; then
  echo -e "${BLUE}🧪 Running e2e tests...${NC}\n"
  npm run test:e2e
fi
