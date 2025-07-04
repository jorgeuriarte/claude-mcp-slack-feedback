# Claude MCP Slack Feedback

A Model Context Protocol (MCP) server that enables Claude Code to request human feedback through Slack during task execution.

## Features

- 🔄 **Real-time feedback**: Ask questions and get responses from your team via Slack
- 🌐 **Webhook support**: Optional cloudflared tunnels for instant responses
- 📊 **Polling mode**: Default mode that works without any additional dependencies
- 👥 **Multi-user support**: Multiple developers can use simultaneously
- 🔀 **Multi-session support**: Handle multiple Claude sessions per user
- 🚀 **Zero-configuration**: Auto-detects users and creates channels
- 💬 **Smart messaging**: Simple updates, reactions, and structured messages
- 🔐 **Local config support**: Store credentials in project-specific `.claude` directory

## Installation

### For Claude Code

#### Option 1: Install from Release (Recommended)

```bash
# Download the latest release tarball
curl -L https://github.com/jorgeuriarte/claude-mcp-slack-feedback/releases/latest/download/claude-mcp-slack-feedback.tgz -o claude-mcp-slack-feedback.tgz

# Install globally
npm install -g ./claude-mcp-slack-feedback.tgz

# Run the automatic installer
claude-mcp-slack-feedback-install

# The installer will:
# - Find or create your Claude Code configuration
# - Add the MCP server automatically
# - Show you the next steps
```

#### Option 2: Build and Install from Source

**Note**: Direct installation from GitHub with `npm install -g github:...` currently has issues due to npm creating broken symlinks. Use Option 1 or build from source as shown below.

1. **Clone and build locally:**
   ```bash
   git clone https://github.com/jorgeuriarte/claude-mcp-slack-feedback.git
   cd claude-mcp-slack-feedback
   npm install
   npm run build
   npm pack
   npm install -g ./claude-mcp-slack-feedback-*.tgz
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

### Architecture

This MCP server uses a Cloud Run architecture for reliable message delivery:

1. **Slack → Cloud Run**: Webhooks deliver messages instantly to the cloud function
2. **MCP → Cloud Run**: Local MCP polls the cloud function for responses

This architecture provides:
- ✅ No local tunnels or port forwarding needed
- ✅ Works behind firewalls and corporate networks
- ✅ Reliable message delivery
- ✅ Automatic scaling

### Webhook Configuration (One-time setup)

Configure your Slack app to send events to the Cloud Run endpoint:

1. **Go to your Slack app configuration:**
   - Visit https://api.slack.com/apps
   - Select your app → "Event Subscriptions"
   - Toggle "Enable Events" to On
   - Set Request URL: `https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/slack/events`
   - Wait for "Verified" ✓
   - Under "Subscribe to bot events", add:
     - `message.channels`
     - `message.groups` 
     - `message.im`
     - `message.mpim`
   - Click "Save Changes"

**Note:** This is a one-time configuration. The Cloud Run endpoint is permanent and doesn't change between sessions.

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

2. **Communication Flow**:
   - **Slack → Cloud Run**: Messages are instantly delivered via webhooks
   - **MCP → Cloud Run**: Local MCP polls the cloud function for new messages

3. **Channel Structure**:
   - Main channel: `#claude-username-main`
   - Session channels: `#claude-username-sessionid`

## Environment Variables

- `CLAUDE_USER_EMAIL`: Set this to match your Slack email for automatic user detection
- `USER` / `USERNAME`: Used as fallback for user detection
- `CLOUD_FUNCTION_URL`: Cloud Run endpoint (defaults to production URL)

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
- **Cloud Polling Client**: Polls Cloud Run for new messages
- **Config Manager**: Persists configuration and sessions
- **Cloud Run Function**: Receives webhooks from Slack and stores messages

## Troubleshooting

### "User not detected"
- Set `CLAUDE_USER_EMAIL` environment variable to your Slack email
- Ensure the bot has `users:read.email` permission

### "Error creating tunnel"
- This error should no longer occur as local tunnels are not used
- If you see this error, please update to the latest version

### "No responses received"
- Check the Slack channel for your messages
- Ensure the bot is in the channel
- Try using `get_responses` again

## License

MIT