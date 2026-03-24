#!/bin/bash

echo "🧪 Setting up test environment..."

# Create test database
docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE gasless_gossip_test;" 2>/dev/null || echo "Test database already exists"

echo "✅ Test environment ready"
echo ""
echo "Run tests with:"
echo "  npm test           # Unit tests"
echo "  npm run test:e2e   # E2E tests"
echo "  npm run test:cov   # Coverage"
