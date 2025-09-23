#!/bin/bash

# Phoenix OKR Live Backend - Production Deployment Script
# This script helps deploy the live backend to various cloud platforms

echo "🚀 Phoenix OKR Live Backend - Production Deployment"
echo "=========================================================="

# Check if we're in the right directory
if [ ! -f "api-server.js" ]; then
    echo "❌ Error: api-server.js not found. Please run this script from the project root directory."
    exit 1
fi

echo "✅ Found api-server.js - ready to deploy"
echo ""

# Show deployment options
echo "🎯 Available Deployment Options:"
echo "1. Railway (Recommended) - Free $5 credit/month"
echo "2. Render - Free 750 hours/month"
echo "3. DigitalOcean App Platform - $5/month"
echo "4. Manual VPS Setup - Variable cost"
echo "5. Export current data for migration"
echo ""

read -p "Choose deployment option (1-5): " choice

case $choice in
    1)
        echo "✨ Railway Deployment Selected"
        echo ""
        echo "📁 Steps to deploy to Railway:"
        echo "1. Visit: https://railway.app"
        echo "2. Sign up with your GitHub account"
        echo "3. Click 'New Project' → 'Deploy from GitHub repo'"
        echo "4. Select 'apotekalpro/Strategy-Phoenix'"
        echo "5. Railway will auto-detect Node.js and deploy"
        echo "6. Get your permanent URL (e.g., https://phoenix-okr.railway.app)"
        echo ""
        echo "🔧 Configuration:"
        echo "- Build Command: npm install"
        echo "- Start Command: node api-server.js"
        echo "- Environment: NODE_ENV=production"
        echo "- Health Check: /health"
        echo ""
        echo "🐈 Railway configuration file already created: railway.json"
        ;;
    2)
        echo "✨ Render Deployment Selected"
        echo ""
        echo "📁 Steps to deploy to Render:"
        echo "1. Visit: https://render.com"
        echo "2. Sign up with your GitHub account"
        echo "3. Click 'New Web Service'"
        echo "4. Connect 'apotekalpro/Strategy-Phoenix' repository"
        echo "5. Configure:"
        echo "   - Build Command: npm install"
        echo "   - Start Command: node api-server.js"
        echo "   - Environment: NODE_ENV=production"
        echo "6. Deploy and get permanent URL"
        echo ""
        echo "🐈 Render configuration file already created: render.yaml"
        ;;
    3)
        echo "✨ DigitalOcean App Platform Selected"
        echo ""
        echo "📁 Steps to deploy to DigitalOcean:"
        echo "1. Visit: https://cloud.digitalocean.com/apps"
        echo "2. Create new app from GitHub repository"
        echo "3. Select 'apotekalpro/Strategy-Phoenix'"
        echo "4. Choose Node.js runtime"
        echo "5. Set start command: node api-server.js"
        echo "6. Deploy ($5/month basic plan)"
        ;;
    4)
        echo "✨ Manual VPS Setup Selected"
        echo ""
        echo "📁 VPS Deployment Steps:"
        echo "1. Get VPS (DigitalOcean, Linode, Vultr, etc.)"
        echo "2. Install Node.js: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        echo "3. Install Node.js: sudo apt-get install -y nodejs"
        echo "4. Clone repository: git clone https://github.com/apotekalpro/Strategy-Phoenix.git"
        echo "5. Install dependencies: npm install"
        echo "6. Install PM2: npm install -g pm2"
        echo "7. Start application: pm2 start api-server.js --name phoenix-backend"
        echo "8. Setup Nginx reverse proxy for port 80/443"
        echo "9. Setup SSL certificate with certbot"
        echo "10. Configure firewall and security"
        ;;
    5)
        echo "📤 Exporting current data for migration..."
        
        if command -v curl &> /dev/null; then
            echo "Attempting to export data from temporary backend..."
            
            # Try to export from the temporary backend
            TEMP_URL="https://3000-iav7cbs5b48623u8gsffj-6532622b.e2b.dev"
            
            if curl -s --fail "$TEMP_URL/api/phoenix-data" > phoenix-data-backup.json; then
                echo "✅ Data exported successfully to: phoenix-data-backup.json"
                echo "📁 File size: $(wc -c < phoenix-data-backup.json) bytes"
                
                # Show data summary
                if command -v python3 &> /dev/null; then
                    echo "📊 Data Summary:"
                    python3 -c "
import json
with open('phoenix-data-backup.json', 'r') as f:
    data = json.load(f)
if data.get('success') and 'data' in data:
    outlets = data['data'].get('outlets', {})
    print(f'  Total outlets: {len(outlets)}')
    for code, outlet in outlets.items():
        obj = outlet.get('okr', {}).get('objective', 'No objective')
        print(f'  - {code}: {obj[:50]}...')
else:
    print('  Raw data exported (check file manually)')
"
                fi
                
                echo ""
                echo "📁 To import this data to your production backend:"
                echo "curl -X POST https://YOUR-PRODUCTION-URL/api/phoenix-data \\"
                echo "  -H 'Content-Type: application/json' \\"
                echo "  -d @phoenix-data-backup.json"
            else
                echo "⚠️ Could not connect to temporary backend. It may have expired."
                echo "This is normal - the temporary backend was meant for testing only."
                echo ""
                echo "If you had important data, you can:"
                echo "1. Check your browser's localStorage for any cached data"
                echo "2. Use the GitHub Pages version which may have your local data"
                echo "3. Recreate your OKR data in the new production environment"
            fi
        else
            echo "⚠️ curl not available. Cannot export data automatically."
        fi
        ;;
    *)
        echo "❌ Invalid option selected."
        exit 1
        ;;
esac

echo ""
echo "📝 Next Steps After Deployment:"
echo "1. Test your production URL to ensure it's working"
echo "2. Update frontend URLs to use production backend"
echo "3. Test cross-device sync with production environment"
echo "4. Update any documentation with new URLs"
echo "5. Set up monitoring and backups"
echo ""
echo "🚀 Your Phoenix OKR system will then have permanent cross-device sync!"
echo "=========================================================="