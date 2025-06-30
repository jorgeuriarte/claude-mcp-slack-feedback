# Deployment Guide

## Overview

This project supports multiple deployment options:

1. **Local Installation** - Run on your machine with Claude Code
2. **Cloud Functions** - Serverless deployment (polling mode only)
3. **Cloud Run** - Container-based with full features (planned)
4. **VM with PM2** - Traditional server deployment (planned)

## Cloud Functions Deployment

### Prerequisites

1. Google Cloud Project with billing enabled
2. GitHub repository with Actions enabled
3. Slack workspace with bot configured

### Required GitHub Secrets

Configure these in your repository settings (Settings → Secrets → Actions):

| Secret Name | Description | Example |
|------------|-------------|---------|
| `GCP_PROJECT_ID` | Your Google Cloud project ID | `my-project-123456` |
| `GCP_SA_KEY` | Service account JSON key with Cloud Functions Admin role | `{"type": "service_account", ...}` |
| `SLACK_BOT_TOKEN` | Slack bot user OAuth token | `xoxb-1234567890-...` |
| `SLACK_WORKSPACE_URL` | Your Slack workspace URL | `myteam.slack.com` |
| `GCP_REGION` | (Optional) Deployment region | `europe-west1` |
| `MONITORING_CHANNEL_ID` | (Optional) Alert notification channel | `projects/.../notificationChannels/...` |

### Setting up Service Account

1. Create a service account:
```bash
gcloud iam service-accounts create mcp-slack-deployer \
  --display-name="MCP Slack Deployer"
```

2. Grant required roles:
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:mcp-slack-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:mcp-slack-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageConsumer"
```

3. Create and download key:
```bash
gcloud iam service-accounts keys create key.json \
  --iam-account=mcp-slack-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

4. Copy the contents of `key.json` to the `GCP_SA_KEY` secret

### Deployment Process

The deployment happens automatically when:
- You push to the `main` branch
- You manually trigger the workflow from Actions tab

To deploy:
1. Merge your changes to `main`
2. The GitHub Action will automatically deploy to Cloud Functions
3. Check the Actions tab for deployment status
4. Find your function URL in the deployment summary

### Testing Before Push

To avoid triggering deployment on push:

1. **Work in feature branches** (like we're doing now)
2. **Test locally with act**:
```bash
act workflow_dispatch --secret-file .env.secrets
```

3. **Create PR for review** before merging to main

### Limitations of Cloud Functions

- **No persistent sessions** - Each request is stateless
- **No webhook support** - Only polling mode works
- **Cold starts** - First request may be slow
- **No cloudflared tunnels** - Can't maintain persistent processes

### After Deployment

1. Configure Claude to use the deployed function:
```json
{
  "claude-mcp-slack-feedback": {
    "command": "curl",
    "args": [
      "-X", "POST",
      "https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/claude-mcp-slack-feedback/mcp",
      "-H", "Content-Type: application/json",
      "-d", "@-"
    ]
  }
}
```

2. Monitor your function:
- Logs: Cloud Console → Cloud Functions → Logs
- Metrics: Deployment creates automatic dashboard
- Alerts: Configure in monitoring setup

### Cost Optimization

- Cloud Functions charges per invocation and compute time
- With typical usage (1000 invocations/day), cost < $5/month
- Monitor usage in Cloud Console → Billing

## Alternative Deployment Options

### Cloud Run (Recommended for Production)

For full feature support including webhooks:
- Container-based deployment
- Supports persistent connections
- Can run cloudflared tunnels
- Better for production use

### VM with PM2

For maximum control:
- Traditional server deployment
- Full state management
- Custom monitoring
- Higher fixed costs