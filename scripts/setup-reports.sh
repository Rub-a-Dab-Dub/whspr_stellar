#!/bin/bash

echo "Setting up Reports System..."

# Install dependencies
echo "Installing dependencies..."
npm install bull

# Create temp-reports directory
echo "Creating temp-reports directory..."
mkdir -p temp-reports

# Run migration
echo "Running database migration..."
npm run migration:run

echo ""
echo "✅ Reports system setup complete!"
echo ""
echo "Next steps:"
echo "1. Ensure Redis is running (required for Bull queue)"
echo "2. Start your application: npm run start:dev"
echo "3. Test the reports API endpoints"
echo ""
echo "Documentation: See REPORTS_API_DOCUMENTATION.md"
