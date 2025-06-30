# Deployment Information

## GCP Configuration

- **Project ID**: `mcp-task-manager-1749028154`
- **Region**: `europe-west1`
- **Service Account**: `mcp-slack-feedback-deployer@mcp-task-manager-1749028154.iam.gserviceaccount.com`
- **Billing Account**: Knoow-io (shared with GAILErpN)

## GitHub Secrets Configured

✅ **GCP_PROJECT_ID**: mcp-task-manager-1749028154
✅ **GCP_REGION**: europe-west1
✅ **GCP_SA_KEY**: Service account key (stored securely)

❌ **SLACK_BOT_TOKEN**: Not yet configured
❌ **SLACK_WORKSPACE_URL**: Not yet configured

## Service Account Key Location

The service account key is stored at:
`~/claude_tools/mcp-slack-feedback/sa-key.json`

⚠️ **IMPORTANT**: Keep this file secure and never commit it to version control.

## Next Steps

1. **Configure Slack secrets**:
   ```bash
   gh secret set SLACK_BOT_TOKEN --body='xoxb-YOUR-TOKEN' --repo='jorgeuriarte/claude-mcp-slack-feedback'
   gh secret set SLACK_WORKSPACE_URL --body='your-workspace.slack.com' --repo='jorgeuriarte/claude-mcp-slack-feedback'
   ```

2. **Deploy**:
   - Option A: Merge to main branch (automatic deployment)
   - Option B: Manual deployment from GitHub Actions

3. **Monitor**:
   - Cloud Console: https://console.cloud.google.com/functions?project=mcp-task-manager-1749028154
   - GitHub Actions: https://github.com/jorgeuriarte/claude-mcp-slack-feedback/actions

## Function URL (after deployment)

The function will be available at:
`https://europe-west1-mcp-task-manager-1749028154.cloudfunctions.net/claude-mcp-slack-feedback`