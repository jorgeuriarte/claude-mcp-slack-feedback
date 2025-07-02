#!/bin/bash

# Create a release tarball for Claude MCP Slack Feedback
# This script builds the project and creates a tarball for distribution

set -e

echo "🚀 Creating release for claude-mcp-slack-feedback"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "📦 Version: $VERSION"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -f claude-mcp-slack-feedback-*.tgz

# Install dependencies
echo "📥 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Create tarball
echo "📦 Creating tarball..."
npm pack

# Rename tarball to include version
TARBALL="claude-mcp-slack-feedback-${VERSION}.tgz"

echo ""
echo "✅ Release tarball created: $TARBALL"
echo ""
echo "📋 Next steps:"
echo "1. Test the tarball locally:"
echo "   npm install -g ./$TARBALL"
echo ""
echo "2. Create a GitHub release and upload the tarball:"
echo "   - Go to https://github.com/jorgeuriarte/claude-mcp-slack-feedback/releases/new"
echo "   - Tag version: v$VERSION"
echo "   - Upload $TARBALL as a release asset"
echo ""
echo "3. Update the download URL in README.md if needed"