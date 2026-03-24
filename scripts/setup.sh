#!/bin/bash

echo "🚀 Setting up Gasless Gossip Backend..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "📝 Creating .env from .env.example..."
  cp .env.example .env
  echo "⚠️  Please update .env with your configuration"
else
  echo "✅ .env already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "✅ PostgreSQL is ready"

# Run migrations
echo "🗄️  Running database migrations..."
npm run migration:run

echo ""
echo "✨ Setup complete!"
echo ""
echo "Start the development server with:"
echo "  npm run start:dev"
echo ""
echo "API will be available at:"
echo "  http://localhost:3001/api"
echo "  http://localhost:3001/api/docs (Swagger)"
