# Debugging Claude MCP Slack Feedback

## Quick Debug Commands

### 1. Check Installation and Version
```bash
claude-mcp-slack-feedback --version
claude-mcp-slack-feedback --info
```

### 2. Enable Debug Mode in Claude Code

When running Claude Code with debug flag:
```bash
claude --debug
```

This should show MCP server logs in the debug output. The MCP server will detect debug mode and write logs to stderr.

### 3. View Log Files Directly

Logs are always written to files regardless of debug mode:
```bash
# Find log directory
claude-mcp-slack-feedback --info

# View latest log
tail -f ~/.claude-mcp-slack-feedback/logs/mcp-*.log
```

### 4. Increase Log Verbosity

Set environment variable before running Claude:
```bash
export MCP_LOG_LEVEL=DEBUG
claude --debug
```

## Understanding the Logs

### Key Log Messages to Look For

1. **Cloud Polling Detection**:
   ```
   [DEBUG] CLOUD_FUNCTION_URL: https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app
   [DEBUG] Using Cloud Polling: true
   ```

2. **Session Mode**:
   ```
   [DEBUG] Session 12345: Set to polling mode
   [DEBUG] Cloud Run architecture active - webhooks handled remotely
   ```

3. **Polling Activity**:
   ```
   [POLLING DEBUG] Using Cloud Polling for session 12345
   [CLOUD POLLING DEBUG] Polling: https://...
   ```

## Common Issues

### Issue: "Error creating tunnel"
This should no longer occur in v1.4.0+ as local tunnels have been removed.

### Issue: Old behavior despite new version
1. Check installed version: `claude-mcp-slack-feedback --version`
2. Check which binary is being used: `which claude-mcp-slack-feedback`
3. Reinstall if needed: `npm install -g claude-mcp-slack-feedback@latest`

### Issue: No debug output in claude --debug
1. Ensure you have the latest version (v1.4.0+)
2. Check if MCP_DEBUG or CLAUDE_DEBUG environment variables are set
3. Try setting explicitly: `MCP_DEBUG=1 claude --debug`

## Environment Variables

### Logging Control
- `MCP_LOG_LEVEL`: Set to DEBUG for verbose logging (default: INFO)

### Debug Output to stderr
The following variables enable output to stderr (any of these will work):
- `MCP_DEBUG`: Set to "1" or "true"
- `CLAUDE_DEBUG`: Set to "1" or "true"
- `MCP_CLAUDE_DEBUG`: Set to "true" (common in MCP ecosystem)
- `DEBUG`: Set to "true" or "*" (standard Node.js debug)

Example:
```bash
# Any of these will enable stderr output:
MCP_DEBUG=1 claude --debug
MCP_CLAUDE_DEBUG=true claude --debug
DEBUG=* claude --debug
```

### Other Variables
- `CLOUD_FUNCTION_URL`: Override default Cloud Run URL

## Log File Location

Logs are stored in: `~/.claude-mcp-slack-feedback/logs/mcp-YYYY-MM-DD.log`

New log file is created each day. Old logs are not automatically cleaned up.