#!/bin/bash
# Git Deployment Script - Commit and push validation logic changes
# Run this script from the project root directory

echo "============================================"
echo "Git Deployment: Commit & Push Changes"
echo "============================================"
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not a git repository. Please run this script from the project root directory."
    exit 1
fi

echo "✓ Found git repository"
echo ""

# Show current git status
echo "📋 Current git status:"
echo "----------------------------------------"
git status --short
echo "----------------------------------------"
echo ""

# Ask for confirmation
read -p "Do you want to commit these changes? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

echo ""
echo "📝 Staging changes..."

# Stage the modified files
git add views/validate.ejs
git add server.js
git add deploy_local.sh
git add deploy_git.sh
git add deploy_server.sh
git add README.md

# Check if crops_hierarchical.json was deleted
if [ ! -f "crops_hierarchical.json" ]; then
    echo "   • Staging deletion of crops_hierarchical.json"
    git rm crops_hierarchical.json 2>/dev/null || echo "   • File already removed from git"
fi

echo ""
echo "✓ Changes staged"
echo ""

# Show what will be committed
echo "📋 Changes to be committed:"
echo "----------------------------------------"
git diff --cached --stat
echo "----------------------------------------"
echo ""

# Create commit with descriptive message
echo "💾 Creating commit..."
COMMIT_MESSAGE="Simplify validation logic: remove redundant correction dropdown

- Remove 'Correct Category' dropdown (was redundant with hierarchical classification)
- Hierarchical classification now appears for both Correct and Incorrect validations
- When incorrect: validator chooses correct class directly from Level 1 hierarchical dropdown
- Removed corrected_classification field from server.js (no longer needed)
- Deleted obsolete crops_hierarchical.json file
- Updated validation workflow to be more streamlined
- All Level 1 categories now come from crops.json (country-specific)

Benefits:
- Simpler user interface
- Less redundancy in data collection
- Consistent hierarchical classification for all validations
- Country-specific land cover classes properly utilized"

git commit -m "$COMMIT_MESSAGE"

if [ $? -ne 0 ]; then
    echo "❌ Error: Commit failed"
    exit 1
fi

echo ""
echo "✓ Commit created successfully"
echo ""

# Show commit details
echo "📋 Commit details:"
echo "----------------------------------------"
git log -1 --stat
echo "----------------------------------------"
echo ""

# Ask for push confirmation
read -p "Do you want to push to remote repository? (yes/no): " push_confirm
if [ "$push_confirm" != "yes" ]; then
    echo "⚠️  Changes committed locally but NOT pushed"
    echo "   Run 'git push' when ready to push to remote"
    exit 0
fi

echo ""
echo "🚀 Pushing to remote repository..."

# Get current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "   Branch: $CURRENT_BRANCH"

# Push to remote
git push origin $CURRENT_BRANCH

if [ $? -ne 0 ]; then
    echo "❌ Error: Push failed"
    echo "   You may need to pull changes first: git pull origin $CURRENT_BRANCH"
    exit 1
fi

echo ""
echo "✓ Successfully pushed to remote repository"
echo ""

echo "============================================"
echo "✅ Git Deployment Complete!"
echo "============================================"
echo ""
echo "📋 Summary:"
echo "   • Committed validation logic changes"
echo "   • Pushed to branch: $CURRENT_BRANCH"
echo "   • Remote repository updated"
echo ""
echo "🔗 Next steps:"
echo "   1. Verify changes on GitHub"
echo "   2. Run deploy_server.sh on the production server"
echo "   3. Test the deployed changes"
echo ""
