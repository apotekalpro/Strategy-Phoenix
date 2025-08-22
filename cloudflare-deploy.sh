#!/bin/bash

# Phoenix OKR - Cloudflare Deployment Script
echo "🚀 Phoenix OKR - Cloudflare Deployment"
echo "======================================"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing Wrangler CLI..."
    npm install -g wrangler
fi

# Login to Cloudflare (if not already logged in)
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "Please login to Cloudflare:"
    wrangler login
fi

# Create D1 database
echo "🗄️ Creating D1 Database..."
wrangler d1 create phoenix-okr-database

echo ""
echo "📝 IMPORTANT: Copy the database ID from above and update wrangler.toml"
echo "   Replace 'your-database-id-here' with the actual database ID"
echo ""
read -p "Press Enter after updating wrangler.toml with the database ID..."

# Run database migrations
echo "🔧 Setting up database schema..."
wrangler d1 execute phoenix-okr-database --file=./src/database-schema.sql

# Create KV namespace (optional)
echo "🗃️ Creating KV namespace..."
wrangler kv:namespace create "PHOENIX_KV"

echo ""
echo "📝 IMPORTANT: Copy the KV namespace ID from above and update wrangler.toml"
echo "   Replace 'your-kv-id-here' with the actual KV namespace ID"
echo ""
read -p "Press Enter after updating wrangler.toml with the KV namespace ID..."

# Deploy the Worker
echo "🚀 Deploying Phoenix OKR API to Cloudflare Workers..."
wrangler deploy

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🌐 Your Phoenix OKR API is now available at:"
echo "   https://phoenix-okr-api.YOUR-SUBDOMAIN.workers.dev"
echo ""
echo "📋 Next Steps:"
echo "1. Test your API: curl https://phoenix-okr-api.YOUR-SUBDOMAIN.workers.dev/api/status"
echo "2. Import your data using the /api/phoenix-data endpoint"
echo "3. Update frontend URLs to use this new API"
echo "4. Set up Cloudflare Pages for the frontend (optional)"
echo ""
echo "🎯 Your Phoenix OKR system now has permanent, global infrastructure!"