# Webhook vs Polling Mode

This MCP server supports two modes for receiving Slack responses:

## Polling Mode (Default)

**How it works:**
- The server periodically checks Slack for new messages
- No external configuration needed
- Works behind firewalls and NAT
- Slight delay in receiving responses (poll interval)

**Best for:**
- Production environments
- Corporate networks
- Quick testing without setup

## Webhook Mode

**How it works:**
- Slack sends events directly to your server in real-time
- Requires a public URL (provided by cloudflared tunnel)
- Instant response delivery
- More efficient for high-volume usage

**Best for:**
- Development and testing
- Real-time interaction needs
- Low-latency requirements

### Setting up Webhook Mode

1. **Automatic tunnel creation:**
   When you first use `ask_feedback`, if cloudflared is installed, the system automatically:
   - Starts a local webhook server
   - Creates a secure tunnel via cloudflared
   - Provides you with a public URL

2. **Configure Slack:**
   The webhook URL changes each session. When you see:
   ```
   🔗 Webhook URL: https://abc123.trycloudflare.com/slack/events
   ```
   
   You need to:
   - Go to your Slack app settings (https://api.slack.com/apps)
   - Navigate to "Event Subscriptions"
   - Enable events
   - Paste the webhook URL in "Request URL"
   - Wait for verification (should be instant)
   - Save changes

3. **Limitations:**
   - URL changes every session
   - Requires manual Slack configuration update
   - Tunnel stops when the MCP server stops

### Choosing the Right Mode

| Feature | Polling | Webhook |
|---------|---------|---------|
| Setup complexity | None | Requires Slack config |
| Response speed | ~1-5 seconds | Instant |
| Reliability | Very high | Depends on tunnel |
| Works behind firewall | Yes | Yes (via tunnel) |
| Production ready | Yes | No (URLs change) |

### Future Improvements

For production webhook usage, consider:
- Setting up a permanent server with fixed URL
- Using ngrok with a paid plan for stable URLs
- Deploying to a cloud platform with HTTPS endpoint