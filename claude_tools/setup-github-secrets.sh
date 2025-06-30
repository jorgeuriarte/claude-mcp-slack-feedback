#!/bin/bash

# Setup GitHub secrets for MCP Slack Feedback deployment

set -e

# Configuration
REPO="jorgeuriarte/claude-mcp-slack-feedback"
PROJECT_ID="mcp-task-manager-1749028154"
REGION="europe-west1"
SA_KEY_FILE="$HOME/claude_tools/mcp-slack-feedback/sa-key.json"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Setting up GitHub secrets for $REPO${NC}"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install it with: brew install gh"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated with GitHub. Running 'gh auth login'...${NC}"
    gh auth login
fi

# Check if service account key exists
if [ ! -f "$SA_KEY_FILE" ]; then
    echo -e "${RED}Error: Service account key not found at $SA_KEY_FILE${NC}"
    exit 1
fi

# Set secrets
echo "Setting GCP_PROJECT_ID..."
gh secret set GCP_PROJECT_ID --body="$PROJECT_ID" --repo="$REPO"

echo "Setting GCP_REGION..."
gh secret set GCP_REGION --body="$REGION" --repo="$REPO"

echo "Setting GCP_SA_KEY..."
gh secret set GCP_SA_KEY --body="$(cat $SA_KEY_FILE)" --repo="$REPO"

# Prompt for Slack tokens
echo ""
echo -e "${YELLOW}Please provide your Slack configuration:${NC}"
read -p "Slack Bot Token (xoxb-...): " SLACK_BOT_TOKEN
read -p "Slack Workspace URL (e.g., myteam.slack.com): " SLACK_WORKSPACE_URL

if [ -n "$SLACK_BOT_TOKEN" ]; then
    echo "Setting SLACK_BOT_TOKEN..."
    gh secret set SLACK_BOT_TOKEN --body="$SLACK_BOT_TOKEN" --repo="$REPO"
fi

if [ -n "$SLACK_WORKSPACE_URL" ]; then
    echo "Setting SLACK_WORKSPACE_URL..."
    gh secret set SLACK_WORKSPACE_URL --body="$SLACK_WORKSPACE_URL" --repo="$REPO"
fi

# Optional: Set monitoring channel
read -p "Monitoring notification email (optional): " NOTIFICATION_EMAIL
if [ -n "$NOTIFICATION_EMAIL" ]; then
    # Create notification channel
    CHANNEL_ID=$(gcloud alpha monitoring channels create \
        --display-name="MCP Slack Feedback Alerts" \
        --type=email \
        --channel-labels=email_address=$NOTIFICATION_EMAIL \
        --project=$PROJECT_ID \
        --format="value(name)" 2>/dev/null || echo "")
    
    if [ -n "$CHANNEL_ID" ]; then
        echo "Setting MONITORING_CHANNEL_ID..."
        gh secret set MONITORING_CHANNEL_ID --body="$CHANNEL_ID" --repo="$REPO"
    fi
fi

echo ""
echo -e "${GREEN}✅ GitHub secrets configured successfully!${NC}"
echo ""
echo "Secrets configured:"
echo "  - GCP_PROJECT_ID: $PROJECT_ID"
echo "  - GCP_REGION: $REGION"
echo "  - GCP_SA_KEY: ✓"
if [ -n "$SLACK_BOT_TOKEN" ]; then
    echo "  - SLACK_BOT_TOKEN: ✓"
fi
if [ -n "$SLACK_WORKSPACE_URL" ]; then
    echo "  - SLACK_WORKSPACE_URL: $SLACK_WORKSPACE_URL"
fi
if [ -n "$CHANNEL_ID" ]; then
    echo "  - MONITORING_CHANNEL_ID: ✓"
fi

echo ""
echo "You can now:"
echo "1. Merge to main branch to trigger automatic deployment"
echo "2. Or manually trigger deployment from GitHub Actions tab"
echo ""
echo "GitHub Actions URL: https://github.com/$REPO/actions"