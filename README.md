# Claude MCP Slack Feedback

A Model Context Protocol (MCP) server that enables Claude Code to request human feedback through Slack during task execution.

## Features

- 🔄 **Real-time feedback**: Ask questions and get responses from your team via Slack
- 🌐 **Webhook support**: Uses cloudflared tunnels for instant responses
- 📊 **Polling fallback**: Works even without webhooks
- 👥 **Multi-user support**: Multiple developers can use simultaneously
- 🔀 **Multi-session support**: Handle multiple Claude sessions per user
- 🚀 **Zero-configuration**: Auto-detects users and creates channels

## Installation

### Quick Install

```bash
git clone https://github.com/yourusername/claude-mcp-slack-feedback.git
cd claude-mcp-slack-feedback
./scripts/install.sh
```

The installer will:
- Check Node.js version (18+ required)
- Optionally install cloudflared for webhook support
- Build the project
- Configure Claude Desktop automatically

### Manual Installation

1. **Clone and build:**
   ```bash
   git clone https://github.com/yourusername/claude-mcp-slack-feedback.git
   cd claude-mcp-slack-feedback
   npm install
   npm run build
   ```

2. **Configure Claude Desktop:**
   
   Add to `~/.config/claude/mcp-servers.json`:
   ```json
   {
     "claude-mcp-slack-feedback": {
       "command": "node",
       "args": ["/path/to/claude-mcp-slack-feedback/dist/index.js"]
     }
   }
   ```

3. **Restart Claude Desktop**

## Slack App Setup

1. **Create a Slack App:**
   - Go to [https://api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From scratch"
   - Name it "Claude Feedback" (or your preference)
   - Select your workspace

2. **Configure OAuth Scopes:**
   
   Under "OAuth & Permissions", add these Bot Token Scopes:
   - `channels:write` - Create channels
   - `chat:write` - Send messages
   - `channels:read` - List channels
   - `users:read` - Get user info
   - `users:read.email` - Match by email

3. **Install to Workspace:**
   - Click "Install to Workspace"
   - Copy the Bot User OAuth Token (starts with `xoxb-`)

4. **Optional: Configure Event Subscriptions (for webhooks):**
   - Enable Events
   - The tunnel URL will be provided when you start a session
   - Subscribe to `message.channels` event

## Usage

### Initial Setup

In Claude, use the setup tool:
```
setup_slack_config with bot token "xoxb-your-token-here"
```

### Asking for Feedback

```
ask_feedback with question "Should I use TypeScript or JavaScript for this project?" and context "Building a web scraper"
```

### Getting Responses

```
get_responses
```

### Updating Progress

```
update_progress with message "Analyzed the requirements, proceeding with implementation" and thread "1234567890.123456"
```

### Managing Sessions

```
list_sessions
```

## How It Works

1. **Session Creation**: When you first use `ask_feedback`, the system:
   - Detects your user (via email or username)
   - Creates a unique session
   - Creates a Slack channel for the session

2. **Communication Modes**:
   - **Webhook Mode**: If cloudflared is installed, creates a tunnel for real-time responses
   - **Polling Mode**: Falls back to checking Slack periodically

3. **Channel Structure**:
   - Main channel: `#claude-username-main`
   - Session channels: `#claude-username-sessionid`

## Environment Variables

- `CLAUDE_USER_EMAIL`: Set this to match your Slack email for automatic user detection
- `USER` / `USERNAME`: Used as fallback for user detection

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run typecheck
```

## Architecture

- **MCP Server**: Handles Claude tool requests
- **Session Manager**: Manages multi-user/multi-session state
- **Slack Client**: Handles Slack API communication with rate limiting
- **Webhook Server**: Express server for receiving Slack events
- **Tunnel Manager**: Manages cloudflared tunnels
- **Config Manager**: Persists configuration and sessions

## Troubleshooting

### "User not detected"
- Set `CLAUDE_USER_EMAIL` environment variable to your Slack email
- Ensure the bot has `users:read.email` permission

### "cloudflared not installed"
- Run the installer again and choose to install cloudflared
- Or install manually: `brew install cloudflare/cloudflare/cloudflared`

### "No responses received"
- Check the Slack channel for your messages
- Ensure the bot is in the channel
- Try using `get_responses` again

## License

MIT