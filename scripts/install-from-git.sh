#!/bin/bash

# Script to install claude-mcp-slack-feedback from git with compiled code

echo "Installing claude-mcp-slack-feedback from git..."

# First, uninstall any existing version
echo "Removing any existing installation..."
npm uninstall -g claude-mcp-slack-feedback 2>/dev/null || true

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Clone the repository
echo "Cloning repository..."
git clone https://github.com/jorgeuriarte/claude-mcp-slack-feedback.git
cd claude-mcp-slack-feedback

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the project
echo "Building project..."
npm run build

# Create a package for global installation
echo "Packing for global installation..."
npm pack

# Install the tarball globally with --ignore-scripts
echo "Installing globally..."
npm install -g claude-mcp-slack-feedback-*.tgz --ignore-scripts

# Clean up
cd ../..
rm -rf "$TEMP_DIR"

echo "Installation complete!"
echo "Verifying installation..."
npm list -g claude-mcp-slack-feedback