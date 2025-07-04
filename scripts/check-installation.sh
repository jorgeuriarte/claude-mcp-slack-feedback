#!/bin/bash

echo "🔍 Claude MCP Slack Feedback - Installation Check"
echo "================================================"
echo ""

# Check global installation
echo "1️⃣ Global npm installation:"
echo "----------------------------"
GLOBAL_PATH=$(npm list -g claude-mcp-slack-feedback 2>/dev/null | grep claude-mcp-slack-feedback@ | head -1)
if [ -n "$GLOBAL_PATH" ]; then
    echo "✅ Found: $GLOBAL_PATH"
    
    # Check version using the binary
    if command -v claude-mcp-slack-feedback &> /dev/null; then
        VERSION=$(claude-mcp-slack-feedback --version 2>/dev/null)
        echo "   Version: $VERSION"
        echo "   Binary: $(which claude-mcp-slack-feedback)"
    fi
else
    echo "❌ Not found in global npm packages"
fi

echo ""
echo "2️⃣ Claude Code configuration:"
echo "------------------------------"
CONFIG_FILE="$HOME/.config/claude/claude_code_config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Config file exists: $CONFIG_FILE"
    # Check if our MCP is configured
    if grep -q "claude-mcp-slack-feedback" "$CONFIG_FILE"; then
        echo "✅ MCP is configured in Claude Code"
        echo ""
        echo "Configuration:"
        jq '.mcpServers."claude-mcp-slack-feedback"' "$CONFIG_FILE" 2>/dev/null || grep -A5 "claude-mcp-slack-feedback" "$CONFIG_FILE"
    else
        echo "❌ MCP not found in Claude Code config"
    fi
else
    echo "❌ Claude Code config not found"
fi

echo ""
echo "3️⃣ Environment variables:"
echo "-------------------------"
echo "CLOUD_FUNCTION_URL: ${CLOUD_FUNCTION_URL:-not set (will use default)}"
echo "CLAUDE_USER_EMAIL: ${CLAUDE_USER_EMAIL:-not set}"
echo "MCP_LOG_LEVEL: ${MCP_LOG_LEVEL:-not set (defaults to INFO)}"

echo ""
echo "4️⃣ Recent logs:"
echo "---------------"
LOG_DIR="$HOME/.claude-mcp-slack-feedback/logs"
if [ -d "$LOG_DIR" ]; then
    LATEST_LOG=$(ls -t "$LOG_DIR"/mcp-*.log 2>/dev/null | head -1)
    if [ -n "$LATEST_LOG" ]; then
        echo "Latest log: $LATEST_LOG"
        echo "Last 5 lines:"
        tail -5 "$LATEST_LOG"
    else
        echo "No log files found"
    fi
else
    echo "Log directory doesn't exist yet"
fi

echo ""
echo "5️⃣ Troubleshooting tips:"
echo "------------------------"
echo "• To see debug logs: ./scripts/view-debug-logs.sh"
echo "• To set debug level: export MCP_LOG_LEVEL=DEBUG"
echo "• To update: npm install -g claude-mcp-slack-feedback@latest"
echo "• To reinstall: claude-mcp-slack-feedback-install"