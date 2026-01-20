#!/bin/bash
# Server Deployment Script - Download and deploy changes on production server
# Run this script on the production server with: sudo bash deploy_server.sh
#
# IMPORTANT: Update REPO_OWNER and REPO_NAME variables below for your repository

echo "============================================"
echo "Server Deployment: Validation Logic Update"
echo "============================================"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ Error: This script must be run with sudo"
    echo "   Usage: sudo bash deploy_server.sh"
    exit 1
fi

echo "✓ Running with sudo privileges"
echo ""

# ============================================
# CONFIGURATION - UPDATE THESE VARIABLES
# ============================================
REPO_OWNER="SERVIR-Amazonia"  # Change this to your GitHub username or organization
REPO_NAME="Land-cover-validation"  # Change this to your repository name
BRANCH="main"  # Change if using a different branch

REPO_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}"
APP_DIR="/home/ubuntu/Land-cover-validation"  # Change if your app is in a different location
BACKUP_DIR="/home/ubuntu/backups/land-cover-validation-$(date +%Y%m%d_%H%M%S)"

# ============================================
# VALIDATION
# ============================================

# Check if application directory exists
if [ ! -d "$APP_DIR" ]; then
    echo "❌ Error: Application directory not found: $APP_DIR"
    echo "   Please update APP_DIR variable in this script"
    exit 1
fi

echo "✓ Found application directory: $APP_DIR"
echo ""

# ============================================
# BACKUP
# ============================================

echo "💾 Creating backup..."
mkdir -p "$BACKUP_DIR"

# Backup current files
cp "$APP_DIR/views/validate.ejs" "$BACKUP_DIR/" 2>/dev/null
cp "$APP_DIR/server.js" "$BACKUP_DIR/" 2>/dev/null
cp "$APP_DIR/crops_hierarchical.json" "$BACKUP_DIR/" 2>/dev/null || echo "   • crops_hierarchical.json not found (expected)"

echo "✓ Backup created at: $BACKUP_DIR"
echo ""

# ============================================
# DOWNLOAD FILES FROM GITHUB
# ============================================

echo "📥 Downloading updated files from GitHub..."
echo "   Repository: https://github.com/${REPO_OWNER}/${REPO_NAME}"
echo ""

cd "$APP_DIR" || exit 1

# Download validate.ejs
echo "   • Downloading views/validate.ejs..."
sudo wget -q "${REPO_URL}/views/validate.ejs" -O views/validate.ejs.tmp

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to download validate.ejs"
    echo "   Check repository URL: ${REPO_URL}/views/validate.ejs"
    exit 1
fi

sudo mv views/validate.ejs.tmp views/validate.ejs

# Download server.js
echo "   • Downloading server.js..."
sudo wget -q "${REPO_URL}/server.js" -O server.js.tmp

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to download server.js"
    echo "   Check repository URL: ${REPO_URL}/server.js"
    exit 1
fi

sudo mv server.js.tmp server.js

echo ""
echo "✓ Files downloaded successfully"
echo ""

# ============================================
# CLEANUP
# ============================================

# Remove obsolete file
if [ -f "crops_hierarchical.json" ]; then
    echo "🗑️  Removing obsolete crops_hierarchical.json..."
    sudo rm crops_hierarchical.json
    echo "✓ File removed"
else
    echo "✓ crops_hierarchical.json already removed"
fi

echo ""

# ============================================
# DOCKER OPERATIONS
# ============================================

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo "⚠️  Warning: Docker daemon is not running"
    echo "   Starting Docker..."
    sudo systemctl start docker
    sleep 3
fi

echo "✓ Docker is available"
echo ""

# Stop current container
echo "🛑 Stopping current container..."
docker stop land-cover-validation 2>/dev/null || echo "   Container not running"

# Remove container
echo "🗑️  Removing old container..."
docker rm land-cover-validation 2>/dev/null || echo "   Container already removed"

# Rebuild Docker image
echo ""
echo "🔨 Building new Docker image..."
cd "$APP_DIR"
docker build -t land-cover-validation:latest .

if [ $? -ne 0 ]; then
    echo "❌ Error: Docker build failed"
    echo ""
    echo "   Restoring backup..."
    cp "$BACKUP_DIR/validate.ejs" "$APP_DIR/views/" 2>/dev/null
    cp "$BACKUP_DIR/server.js" "$APP_DIR/" 2>/dev/null
    echo "   ✓ Backup restored"
    exit 1
fi

echo ""
echo "✓ Docker image built successfully"
echo ""

# Start new container
echo "🚀 Starting new container..."
docker run -d \
  --name land-cover-validation \
  --restart unless-stopped \
  -p 3000:3000 \
  -v "$APP_DIR/secrets:/app/secrets" \
  -v "$APP_DIR/public/photos:/app/public/photos" \
  land-cover-validation:latest

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to start container"
    echo ""
    echo "   Restoring backup..."
    cp "$BACKUP_DIR/validate.ejs" "$APP_DIR/views/" 2>/dev/null
    cp "$BACKUP_DIR/server.js" "$APP_DIR/" 2>/dev/null
    echo "   ✓ Backup restored"
    echo ""
    echo "   Please check Docker logs and try manual deployment"
    exit 1
fi

echo ""
echo "✓ Container started successfully"
echo ""

# ============================================
# VERIFICATION
# ============================================

# Wait for application to start
echo "⏳ Waiting for application to start..."
sleep 8

# Check if application is responding
if curl -s http://localhost:3000 > /dev/null; then
    echo "✓ Application is responding"
else
    echo "⚠️  Warning: Application may not be responding yet"
    echo "   Check logs with: docker logs land-cover-validation"
fi

echo ""
echo "============================================"
echo "✅ Server Deployment Complete!"
echo "============================================"
echo ""
echo "📋 Summary:"
echo "   • Files downloaded from GitHub"
echo "   • Backup saved to: $BACKUP_DIR"
echo "   • Docker container rebuilt and restarted"
echo "   • Application running on port 3000"
echo ""
echo "🔍 Changes applied:"
echo "   • Removed 'Correct Category' dropdown"
echo "   • Hierarchical classification for Correct/Incorrect"
echo "   • Removed corrected_classification field"
echo "   • Deleted crops_hierarchical.json"
echo ""
echo "📋 Verification steps:"
echo "   1. Check application: curl http://localhost:3000"
echo "   2. View logs: docker logs -f land-cover-validation"
echo "   3. Test validation workflow in browser"
echo ""
echo "⚠️  If issues occur, restore backup with:"
echo "   sudo cp $BACKUP_DIR/validate.ejs $APP_DIR/views/"
echo "   sudo cp $BACKUP_DIR/server.js $APP_DIR/"
echo "   cd $APP_DIR && sudo docker-compose up -d --build"
echo ""
