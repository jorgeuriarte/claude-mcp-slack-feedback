# Claude MCP Slack Feedback

A Model Context Protocol (MCP) server that enables Claude Code to request human feedback through Slack during task execution.

## Features

- 🔄 **Real-time feedback**: Ask questions and get responses from your team via Slack
- 🌐 **Webhook support**: Optional cloudflared tunnels for instant responses
- 📊 **Polling mode**: Default mode that works without any additional dependencies
- 👥 **Multi-user support**: Multiple developers can use simultaneously
- 🔀 **Multi-session support**: Handle multiple Claude sessions per user
- 🚀 **Zero-configuration**: Auto-detects users and creates channels

## Installation

### For Claude Code

#### Option 1: Automatic Installation (Recommended)

```bash
# Install and configure automatically (no build required!)
npm install -g github:jorgeuriarte/claude-mcp-slack-feedback#feature/hybrid-architecture
claude-mcp-slack-feedback-install

# The installer will:
# - Find or create your Claude Code configuration
# - Add the MCP server automatically
# - Show you the next steps

# Note: The package runs TypeScript directly, no compilation needed
```

#### Option 2: Manual npm install from Git

1. **Install globally from Git:**
   ```bash
   # For the latest stable version:
   npm install -g github:jorgeuriarte/claude-mcp-slack-feedback
   
   # Or for the development version:
   npm install -g github:jorgeuriarte/claude-mcp-slack-feedback#feature/hybrid-architecture
   ```

2. **Configure Claude Code:**
   
   Add to your Claude Code settings file (usually `~/.config/claude/settings.json`):
   ```json
   {
     "mcp": {
       "servers": {
         "claude-mcp-slack-feedback": {
           "command": "claude-mcp-slack-feedback"
         }
       }
     }
   }
   ```

3. **Start a new Claude Code session** to activate the MCP server.

#### Option 3: Manual build

1. **Clone and build:**
   ```bash
   git clone https://github.com/jorgeuriarte/claude-mcp-slack-feedback.git
   cd claude-mcp-slack-feedback
   npm install
   npm run build
   ```

2. **Configure Claude Code:**
   
   Add to your Claude Code settings file:
   ```json
   {
     "mcp": {
       "servers": {
         "claude-mcp-slack-feedback": {
           "command": "node",
           "args": ["/absolute/path/to/claude-mcp-slack-feedback/dist/index.js"]
         }
       }
     }
   }
   ```

3. **Start a new Claude Code session** to activate the MCP server.

### For Claude Desktop

1. **Clone and build:**
   ```bash
   git clone https://github.com/jorgeuriarte/claude-mcp-slack-feedback.git
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

### Option 1: Using App Manifest (Recommended)

1. **Create app from manifest:**
   - Go to [https://api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From an app manifest"
   - Select your workspace
   - Choose "YAML" format
   - Copy and paste the contents of `slack-app-manifest.yml`
   - Review and create

2. **Install to workspace:**
   - Click "Install to Workspace"
   - Copy the Bot User OAuth Token (starts with `xoxb-`)

### Option 2: Manual Setup

1. **Create a Slack App:**
   - Go to [https://api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From scratch"
   - Name it "Claude MCP Feedback"
   - Select your workspace

2. **Configure OAuth Scopes:**
   
   Under "OAuth & Permissions", add these Bot Token Scopes:
   - `channels:manage` - Create and manage channels
   - `chat:write` - Send messages
   - `channels:read` - List channels
   - `users:read` - Get user info
   - `users:read.email` - Match by email
   - `channels:history` - Read channel messages
   - `groups:read` - Access private channels
   - `groups:history` - Read private channel messages
   - `im:read` - Access direct messages
   - `im:history` - Read direct messages
   - `mpim:read` - Access group direct messages
   - `mpim:history` - Read group direct messages

3. **Optional: Configure Event Subscriptions (for webhooks):**
   - Enable Events
   - The tunnel URL will be provided when you start a session
   - Subscribe to bot events:
     - `message.channels`
     - `message.groups`
     - `message.im`
     - `message.mpim`

4. **Install to Workspace:**
   - Click "Install to Workspace"
   - Copy the Bot User OAuth Token (starts with `xoxb-`)

## Usage

### Initial Setup

In Claude, use the setup tool:
```
setup_slack_config with bot token "xoxb-your-token-here"
```

### Webhook Mode Setup (Optional - Advanced Users)

**By default, the bot uses polling mode which works great for most users. Webhooks are optional.**

If you want real-time responses via webhooks:

1. **First time using `ask_feedback`:**
   - The system will show: `🔗 Webhook URL: https://abc123.trycloudflare.com/slack/events`
   - Copy this URL

2. **Configure Slack for webhooks:**
   - Go to your app at https://api.slack.com/apps
   - Select your app → "Event Subscriptions" 
   - Toggle "Enable Events" to On
   - Paste the webhook URL in "Request URL"
   - Wait for "Verified" ✓ 
   - Under "Subscribe to bot events", add:
     - `message.channels`
     - `message.groups` 
     - `message.im`
     - `message.mpim`
   - Click "Save Changes"

**Important notes about webhooks:**
- The URL changes every session (it's a temporary tunnel)
- You need to update Slack settings each time
- For this reason, **polling mode is recommended for regular use**
- Webhooks are mainly useful for testing real-time features

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