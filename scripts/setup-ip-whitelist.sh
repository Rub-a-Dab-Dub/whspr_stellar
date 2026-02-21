#!/bin/bash

# IP Whitelist Feature Setup Script
# This script helps set up the IP whitelist security feature

set -e

echo "🔐 IP Whitelist Feature Setup"
echo "=============================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
fi

# Check if ADMIN_IP_WHITELIST_ENABLED is already in .env
if grep -q "ADMIN_IP_WHITELIST_ENABLED" .env; then
    echo "✅ ADMIN_IP_WHITELIST_ENABLED already exists in .env"
else
    echo "📝 Adding ADMIN_IP_WHITELIST_ENABLED to .env..."
    echo "" >> .env
    echo "# Admin Security" >> .env
    echo "ADMIN_IP_WHITELIST_ENABLED=false" >> .env
    echo "✅ Added ADMIN_IP_WHITELIST_ENABLED=false to .env"
fi

echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🗄️  Running database migration..."
npm run migration:run

echo ""
echo "✅ Setup complete!"
echo ""
echo "⚠️  IMPORTANT: Before enabling the feature, add your IP to the whitelist:"
echo ""
echo "1. Start the server:"
echo "   npm run start:dev"
echo ""
echo "2. Get your current IP address:"
echo "   curl -s https://api.ipify.org"
echo ""
echo "3. Add your IP to whitelist (replace YOUR_TOKEN and YOUR_IP):"
echo "   curl -X POST http://localhost:3000/admin/security/ip-whitelist \\"
echo "     -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"ipCidr\": \"YOUR_IP/32\", \"description\": \"My admin IP\"}'"
echo ""
echo "4. Enable the feature in .env:"
echo "   ADMIN_IP_WHITELIST_ENABLED=true"
echo ""
echo "5. Restart the server"
echo ""
echo "📚 See IP_WHITELIST.md for full documentation"
