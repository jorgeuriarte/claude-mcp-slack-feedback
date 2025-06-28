#!/bin/bash

# Script to generate a customized Slack app manifest

echo "======================================"
echo "Slack App Manifest Generator"
echo "======================================"
echo

# Default values
DEFAULT_NAME="Claude MCP Feedback"
DEFAULT_BOT_NAME="Claude Feedback Bot"

# Get custom values
read -p "App name [$DEFAULT_NAME]: " APP_NAME
APP_NAME=${APP_NAME:-$DEFAULT_NAME}

read -p "Bot display name [$DEFAULT_BOT_NAME]: " BOT_NAME
BOT_NAME=${BOT_NAME:-$DEFAULT_BOT_NAME}

# Generate manifest
cat > slack-app-manifest-custom.yml << EOF
display_information:
  name: $APP_NAME
  description: Enables Claude Code to request human feedback through Slack
  background_color: "#4A154B"
  long_description: This app allows Claude Code (AI assistant) to ask questions and receive feedback from your team during task execution. It creates dedicated channels for each session and supports both real-time webhooks and polling for responses.

features:
  bot_user:
    display_name: $BOT_NAME
    always_online: true

oauth_config:
  scopes:
    bot:
      - channels:write
      - chat:write
      - channels:read
      - users:read
      - users:read.email
      - channels:history
      - groups:history
      - im:history
      - mpim:history

settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
EOF

echo
echo "✅ Generated slack-app-manifest-custom.yml"
echo
echo "Next steps:"
echo "1. Go to https://api.slack.com/apps"
echo "2. Click 'Create New App' → 'From an app manifest'"
echo "3. Copy the contents of slack-app-manifest-custom.yml"
echo "4. Create the app and install to your workspace"
echo