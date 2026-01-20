#!/bin/bash
# Local Deployment Script - Update validation logic changes
# Run this script from the project root directory

echo "============================================"
echo "Local Deployment: Validation Logic Update"
echo "============================================"
echo ""

# Check if we're in the correct directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: server.js not found. Please run this script from the project root directory."
    exit 1
fi

echo "✓ Found project root directory"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "⚠️  Warning: Docker is not running. Please start Docker first."
    echo "   After starting Docker, run this script again."
    exit 1
fi

echo "✓ Docker is running"
echo ""

# Stop the running container
echo "🛑 Stopping Land Cover Validation container..."
docker stop land-cover-validation 2>/dev/null || echo "   Container not running"

# Remove the container
echo "🗑️  Removing old container..."
docker rm land-cover-validation 2>/dev/null || echo "   Container already removed"

# Rebuild the Docker image
echo ""
echo "🔨 Building new Docker image..."
docker build -t land-cover-validation:latest .

if [ $? -ne 0 ]; then
    echo "❌ Error: Docker build failed"
    exit 1
fi

echo ""
echo "✓ Docker image built successfully"
echo ""

# Start the new container
echo "🚀 Starting new container..."
docker run -d \
  --name land-cover-validation \
  -p 3000:3000 \
  -v "$(pwd)/secrets:/app/secrets" \
  -v "$(pwd)/public/photos:/app/public/photos" \
  land-cover-validation:latest

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to start container"
    exit 1
fi

echo ""
echo "✓ Container started successfully"
echo ""

# Wait for the application to start
echo "⏳ Waiting for application to start..."
sleep 5

# Check if the application is responding
if curl -s http://localhost:3000 > /dev/null; then
    echo "✓ Application is responding"
else
    echo "⚠️  Warning: Application may not be responding yet. Check logs with: docker logs land-cover-validation"
fi

echo ""
echo "============================================"
echo "✅ Deployment Complete!"
echo "============================================"
echo ""
echo "📋 Next steps:"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Test the validation workflow:"
echo "      - Click on a validation"
echo "      - Test 'Correct' button → hierarchical classification"
echo "      - Test 'Incorrect' button → hierarchical classification"
echo "      - Test 'Review' button → direct submit"
echo "   3. Check logs: docker logs -f land-cover-validation"
echo ""
echo "🔍 Changes applied:"
echo "   • Removed 'Correct Category' dropdown"
echo "   • Hierarchical classification now appears for both Correct/Incorrect"
echo "   • Removed redundant corrected_classification field"
echo "   • Deleted obsolete crops_hierarchical.json file"
echo ""
