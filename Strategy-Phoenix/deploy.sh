#!/bin/bash

# Deployment script for OKR Phoenix Project
# This script handles deployment to GitHub Pages

echo "🚀 Starting deployment process..."

# Check if we're in the right directory
if [ ! -f "okr-dashboard-v2.html" ]; then
    echo "❌ Error: Not in the correct project directory"
    exit 1
fi

# Add all changes
echo "📦 Adding all changes..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "ℹ️  No changes to commit"
else
    # Prompt for commit message
    echo "✏️  Enter commit message (or press Enter for default):"
    read commit_message
    
    if [ -z "$commit_message" ]; then
        commit_message="chore: Update OKR application deployment"
    fi
    
    # Commit changes
    echo "💾 Committing changes..."
    git commit -m "$commit_message"
fi

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main

# Check if push was successful
if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🌐 Your application is now live at:"
    echo "   • GitHub Repository: https://github.com/apotekalpro/Strategy-Phoenix"
    echo "   • GitHub Pages URL: https://apotekalpro.github.io/Strategy-Phoenix/"
    echo "   • Direct Dashboard: https://apotekalpro.github.io/Strategy-Phoenix/okr-dashboard-v2.html"
    echo "   • Login Page: https://apotekalpro.github.io/Strategy-Phoenix/login.html"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Enable GitHub Pages in repository settings"
    echo "   2. Set up Google Sheets API key in config.js"
    echo "   3. Test the authentication system"
    echo ""
else
    echo "❌ Deployment failed! Please check your Git configuration and try again."
    exit 1
fi