#!/bin/bash

echo "🔍 Verifying Gasless Gossip Backend Setup..."
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
node_version=$(node -v)
echo "   Node.js: $node_version"

# Check npm
npm_version=$(npm -v)
echo "   npm: $npm_version"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "❌ node_modules not found. Run: npm install"
  exit 1
fi
echo "✅ Dependencies installed"

# Check if .env exists
if [ ! -f ".env" ]; then
  echo "❌ .env file not found. Run: cp .env.example .env"
  exit 1
fi
echo "✅ .env file exists"

# Check if build works
echo ""
echo "🔨 Testing build..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Build successful"
else
  echo "❌ Build failed. Check for TypeScript errors"
  exit 1
fi

# Check if tests pass
echo ""
echo "🧪 Running tests..."
npm test -- --passWithNoTests --silent > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Tests passed"
else
  echo "❌ Tests failed"
  exit 1
fi

echo ""
echo "✨ All checks passed!"
echo ""
echo "Next steps:"
echo "  1. Start Docker: docker-compose up -d (or sudo docker-compose up -d)"
echo "  2. Run migrations: npm run migration:run"
echo "  3. Start dev server: npm run start:dev"
