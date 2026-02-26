#!/bin/bash

# Quick Start Script for Platform Configuration System
# This script helps you get started quickly

echo "🚀 Platform Configuration System - Quick Start"
echo "=============================================="
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Check if Redis is running
echo "🔍 Checking Redis connection..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "❌ Redis is not running"
    echo "   Start Redis with: docker run -d -p 6379:6379 redis:alpine"
    echo "   Or: redis-server"
    exit 1
fi
echo ""

# Check if PostgreSQL is accessible
echo "🔍 Checking PostgreSQL connection..."
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

DB_HOST=${DATABASE_HOST:-localhost}
DB_PORT=${DATABASE_PORT:-5432}
DB_USER=${DATABASE_USER:-postgres}
DB_NAME=${DATABASE_NAME:-whspr}

echo "   Host: $DB_HOST:$DB_PORT"
echo "   Database: $DB_NAME"
echo ""

echo "📋 Next Steps:"
echo ""
echo "1. Run the database migration:"
echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f src/database/migrations/platform-config-setup.sql"
echo ""
echo "2. Make a user an admin:"
echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"UPDATE users SET \\\"isAdmin\\\" = TRUE WHERE email = 'your-email@example.com';\""
echo ""
echo "3. Start the application:"
echo "   npm run start:dev"
echo ""
echo "4. Test the API (get your JWT token first):"
echo "   curl -X GET http://localhost:3001/admin/config -H \"Authorization: Bearer YOUR_TOKEN\""
echo ""
echo "📚 Documentation:"
echo "   - PLATFORM_CONFIG.md - Feature documentation"
echo "   - IMPLEMENTATION_SUMMARY.md - Implementation overview"
echo "   - VERIFICATION_CHECKLIST.md - Detailed verification steps"
echo ""
echo "✨ Happy coding!"
