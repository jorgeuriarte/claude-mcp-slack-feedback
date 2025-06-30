# Webhook vs Polling Mode

This MCP server supports two modes for receiving Slack responses:

## Polling Mode (Default)

**How it works:**
- The server periodically checks Slack for new messages
- No external dependencies required
- Works behind firewalls and NAT
- Responses are checked every few seconds

**Best for:**
- Production environments
- Corporate networks
- Quick testing without setup
- When cloudflared is not available

## Webhook Mode (Optional)

**How it works:**
- Slack sends events directly to your server in real-time
- Requires cloudflared to be installed (optional dependency)
- Provides a public URL via cloudflared tunnel
- Instant response delivery
- More efficient for high-volume usage

**Requirements:**
- cloudflared must be installed (`brew install cloudflare/cloudflare/cloudflared` on macOS)
- The server will automatically detect if cloudflared is available

**Best for:**
- Development and testing
- Real-time interaction needs
- Low-latency requirements

### Setting up Webhook Mode

1. **Install cloudflared (optional):**
   ```bash
   # macOS
   brew install cloudflare/cloudflare/cloudflared
   
   # Linux - see https://github.com/cloudflare/cloudflared/releases
   ```

2. **Automatic mode detection:**
   When you first use `ask_feedback`, the system automatically:
   - Checks if cloudflared is available
   - If yes: Sets up webhook mode with tunnel
   - If no: Uses polling mode (no action needed)

3. **Configure Slack (only if using webhook mode):**
   If webhook mode is active, you'll see:
   ```
   🔗 Webhook configured: https://abc123.trycloudflare.com/slack/events
   ```
   
   To enable real-time events:
   - Go to your Slack app settings (https://api.slack.com/apps)
   - Navigate to "Event Subscriptions"
   - Enable events
   - Paste the webhook URL in "Request URL"
   - Wait for verification (should be instant)
   - Save changes
   
   **Note:** This step is optional. The system works fine with polling mode.

4. **Limitations of webhook mode:**
   - URL changes every session
   - Requires manual Slack configuration update
   - Tunnel stops when the MCP server stops
   - Requires cloudflared to be installed

### Choosing the Right Mode

| Feature | Polling (Default) | Webhook (Optional) |
|---------|-------------------|-------------------|
| Setup complexity | None | Requires cloudflared + Slack config |
| Response speed | ~2-5 seconds | Instant |
| Reliability | Very high | Depends on tunnel |
| Works behind firewall | Yes | Yes (via tunnel) |
| External dependencies | None | cloudflared |
| Production ready | Yes | No (URLs change) |

### Future Improvements

For production webhook usage, consider:
- Setting up a permanent server with fixed URL
- Using ngrok with a paid plan for stable URLs
- Deploying to a cloud platform with HTTPS endpoint