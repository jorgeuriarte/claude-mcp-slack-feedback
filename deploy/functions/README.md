# Cloud Functions Deployment

This directory contains the configuration for deploying the Claude MCP Slack Feedback server to Google Cloud Functions.

## Architecture

The MCP server is deployed as a Cloud Function (Gen 2) which provides:
- Auto-scaling based on demand
- Built-in HTTPS endpoint
- Managed infrastructure
- Pay-per-use pricing

## Limitations & Considerations

Since Cloud Functions are stateless, this deployment uses:
- **Polling mode by default** - Webhooks require persistent connections which don't work well with Functions
- **Session state in memory** - Sessions are lost when function instances scale down
- **No cloudflared tunnels** - Functions can't maintain long-running tunnel processes

For production use with webhook support, consider using:
- Google Cloud Run with persistent containers
- Compute Engine VM with PM2
- Google Kubernetes Engine

## Deployment

### Prerequisites

1. Google Cloud Project with billing enabled
2. Service account with Cloud Functions Admin role
3. Slack Bot Token and Workspace URL
4. GitHub repository secrets configured

### Required Secrets

Configure these in your GitHub repository settings:
- `GCP_PROJECT_ID` - Your Google Cloud project ID
- `GCP_SA_KEY` - Service account JSON key
- `SLACK_BOT_TOKEN` - Your Slack bot token (xoxb-...)
- `SLACK_WORKSPACE_URL` - Your Slack workspace URL

### Deploy

The function deploys automatically on push to main branch, or manually via:

```bash
# From GitHub Actions tab, run "Deploy to Google Cloud Functions" workflow
```

### Local Testing

```bash
cd deploy/functions
npm install
npm start
# Function will be available at http://localhost:8080
```

## Configuration

After deployment, configure Claude to use the function:

```json
{
  "claude-mcp-slack-feedback": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/client",
      "connect",
      "https://[REGION]-[PROJECT].cloudfunctions.net/claude-mcp-slack-feedback/mcp"
    ]
  }
}
```

## Monitoring

- **Logs**: View in Cloud Console > Cloud Functions > Logs
- **Metrics**: Automatic metrics for invocations, errors, latency
- **Alerts**: Configured for error rates > 5%

## Cost Estimation

With typical usage:
- ~1000 invocations/day
- ~512MB memory
- ~10s average execution time

Estimated monthly cost: < $5 USD