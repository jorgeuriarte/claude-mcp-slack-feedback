#!/bin/bash

# Automated setup of GitHub secrets (without Slack tokens for now)

set -e

REPO="jorgeuriarte/claude-mcp-slack-feedback"
PROJECT_ID="mcp-task-manager-1749028154"
REGION="europe-west1"
SA_KEY_FILE="$HOME/claude_tools/mcp-slack-feedback/sa-key.json"

echo "Setting up GitHub secrets for $REPO"

# Set GCP secrets
echo "Setting GCP_PROJECT_ID..."
gh secret set GCP_PROJECT_ID --body="$PROJECT_ID" --repo="$REPO"

echo "Setting GCP_REGION..."
gh secret set GCP_REGION --body="$REGION" --repo="$REPO"

echo "Setting GCP_SA_KEY..."
gh secret set GCP_SA_KEY --body="$(cat $SA_KEY_FILE)" --repo="$REPO"

echo ""
echo "✅ GCP secrets configured!"
echo ""
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""
echo "⚠️  You still need to configure Slack secrets manually:"
echo "  - SLACK_BOT_TOKEN"
echo "  - SLACK_WORKSPACE_URL"
echo ""
echo "Use: gh secret set SLACK_BOT_TOKEN --body='xoxb-...' --repo='$REPO'"
echo "Use: gh secret set SLACK_WORKSPACE_URL --body='your-workspace.slack.com' --repo='$REPO'"