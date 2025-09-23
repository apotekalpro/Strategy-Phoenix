#!/bin/bash

# Phoenix OKR - Complete Cloudflare Deployment Script
# This script walks you through the entire deployment process

echo "🌟 Phoenix OKR - Cloudflare Workers + D1 Deployment"
echo "===================================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check if we're in the right directory
if [ ! -f "wrangler.toml" ]; then
    echo -e "${RED}❌ Error: wrangler.toml not found. Please run this script from the project root directory.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found wrangler.toml - ready to deploy${NC}"
echo ""

# Step 2: Check if wrangler is available
if ! command -v wrangler &> /dev/null && ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ Error: Neither 'wrangler' nor 'npx' found. Please install Node.js and npm.${NC}"
    exit 1
fi

# Use npx wrangler if global wrangler is not available
WRANGLER_CMD="npx wrangler"
if command -v wrangler &> /dev/null; then
    WRANGLER_CMD="wrangler"
fi

echo -e "${BLUE}📦 Using: $WRANGLER_CMD${NC}"
echo ""

# Step 3: Login to Cloudflare
echo -e "${YELLOW}🔐 Step 1: Cloudflare Authentication${NC}"
echo "This will open your browser to login to Cloudflare..."
echo ""
read -p "Press Enter to continue with login..."

if ! $WRANGLER_CMD whoami &> /dev/null; then
    echo "Logging in to Cloudflare..."
    $WRANGLER_CMD login
    
    if ! $WRANGLER_CMD whoami &> /dev/null; then
        echo -e "${RED}❌ Login failed. Please try again.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Successfully authenticated with Cloudflare${NC}"
echo ""

# Step 4: Create D1 Database
echo -e "${YELLOW}🗄️ Step 2: Creating D1 Database${NC}"
echo "Creating your Phoenix OKR database..."
echo ""

DB_OUTPUT=$($WRANGLER_CMD d1 create phoenix-okr-database 2>&1)
echo "$DB_OUTPUT"

# Extract database ID from output
DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+' | head -1)

if [ -z "$DB_ID" ]; then
    echo -e "${YELLOW}⚠️ Could not automatically extract database ID.${NC}"
    echo "Please copy the database_id from the output above and enter it below:"
    read -p "Database ID: " DB_ID
fi

if [ ! -z "$DB_ID" ]; then
    echo -e "${GREEN}✅ Database ID: $DB_ID${NC}"
    
    # Update wrangler.toml with the actual database ID
    sed -i "s/your-database-id-here/$DB_ID/g" wrangler.toml
    echo -e "${GREEN}✅ Updated wrangler.toml with database ID${NC}"
else
    echo -e "${RED}❌ Database ID is required. Please update wrangler.toml manually.${NC}"
    exit 1
fi

echo ""

# Step 5: Setup Database Schema
echo -e "${YELLOW}🔧 Step 3: Setting up Database Schema${NC}"
echo "Creating tables and structure..."

if $WRANGLER_CMD d1 execute phoenix-okr-database --file=./src/database-schema.sql; then
    echo -e "${GREEN}✅ Database schema created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create database schema${NC}"
    exit 1
fi

echo ""

# Step 6: Deploy Worker
echo -e "${YELLOW}🚀 Step 4: Deploying to Cloudflare Workers${NC}"
echo "Deploying your Phoenix OKR API..."

DEPLOY_OUTPUT=$($WRANGLER_CMD deploy 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract Worker URL
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[^/]+\.workers\.dev' | head -1)

if [ ! -z "$WORKER_URL" ]; then
    echo ""
    echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
    echo ""
    echo -e "${BLUE}🌐 Your Phoenix OKR API is now live at:${NC}"
    echo -e "${GREEN}   $WORKER_URL${NC}"
    echo ""
    
    # Save URL for later use
    echo "$WORKER_URL" > cloudflare-worker-url.txt
    
else
    echo -e "${RED}❌ Deployment may have failed. Please check the output above.${NC}"
    exit 1
fi

# Step 7: Test the deployment
echo -e "${YELLOW}🧪 Step 5: Testing Deployment${NC}"
echo "Testing your API..."

if curl -s --fail "$WORKER_URL/api/status" > /dev/null; then
    echo -e "${GREEN}✅ API is responding correctly${NC}"
    
    # Show status
    echo ""
    echo -e "${BLUE}📊 API Status:${NC}"
    curl -s "$WORKER_URL/api/status" | jq '.' 2>/dev/null || curl -s "$WORKER_URL/api/status"
    
else
    echo -e "${YELLOW}⚠️ API test failed. The deployment might need a few moments to propagate.${NC}"
fi

echo ""

# Step 8: Import existing data
echo -e "${YELLOW}📥 Step 6: Import Your Existing Phoenix OKR Data${NC}"

if [ -f "phoenix-data-backup.json" ]; then
    echo "Found your backed up data ($(wc -c < phoenix-data-backup.json) bytes)"
    echo ""
    read -p "Would you like to import your existing OKR data now? (y/n): " import_choice
    
    if [[ $import_choice == "y" || $import_choice == "Y" ]]; then
        echo "Importing data..."
        
        if curl -s -X POST "$WORKER_URL/api/phoenix-data" \
           -H "Content-Type: application/json" \
           -d @phoenix-data-backup.json > /dev/null; then
            echo -e "${GREEN}✅ Data imported successfully${NC}"
        else
            echo -e "${YELLOW}⚠️ Data import failed. You can try again later with:${NC}"
            echo "curl -X POST $WORKER_URL/api/phoenix-data -H 'Content-Type: application/json' -d @phoenix-data-backup.json"
        fi
    fi
else
    echo -e "${YELLOW}⚠️ No backup data found. You can import data later if needed.${NC}"
fi

echo ""
echo -e "${GREEN}🎉 CLOUDFLARE DEPLOYMENT COMPLETE!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   🌐 API URL: ${GREEN}$WORKER_URL${NC}"
echo -e "   🗄️ Database: ${GREEN}D1 SQLite (phoenix-okr-database)${NC}"
echo -e "   📊 Status: ${GREEN}$WORKER_URL/api/status${NC}"
echo -e "   📖 API Docs: ${GREEN}$WORKER_URL/api/phoenix-data${NC}"
echo ""
echo -e "${BLUE}🔗 Key Endpoints:${NC}"
echo -e "   • GET  $WORKER_URL/api/status"
echo -e "   • GET  $WORKER_URL/api/phoenix-data"
echo -e "   • POST $WORKER_URL/api/phoenix-data"
echo -e "   • GET  $WORKER_URL/api/outlet/{code}"
echo -e "   • POST $WORKER_URL/api/outlet/{code}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Update your frontend files to use the new API URL"
echo "2. Test cross-device synchronization"
echo "3. Update any documentation with the new URL"
echo "4. Consider setting up a custom domain (optional)"
echo ""
echo -e "${GREEN}🎯 Your Phoenix OKR system now has permanent, global infrastructure!${NC}"
echo "The URL will never expire and will scale automatically worldwide."
echo ""