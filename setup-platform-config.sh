#!/bin/bash

# Platform Config Setup Script
# This script sets up the platform configuration system

set -e

echo "🚀 Setting up Platform Configuration System..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Database connection details
DB_HOST=${DATABASE_HOST:-localhost}
DB_PORT=${DATABASE_PORT:-5432}
DB_USER=${DATABASE_USER:-postgres}
DB_NAME=${DATABASE_NAME:-whspr}

echo "📊 Running database migrations..."

# Run the SQL migration
PGPASSWORD=$DATABASE_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f src/database/migrations/platform-config-setup.sql

echo "✅ Platform config table created"
echo "✅ Default configuration values inserted"
echo "✅ isAdmin column added to users table"

echo ""
echo "🔐 To make a user an admin, run:"
echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"UPDATE users SET \\\"isAdmin\\\" = TRUE WHERE email = 'your-email@example.com';\""

echo ""
echo "✨ Setup complete! Start your server with: npm run start:dev"
