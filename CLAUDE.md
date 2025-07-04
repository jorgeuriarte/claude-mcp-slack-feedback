# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Claude MCP Slack Feedback project - a Model Context Protocol (MCP) server that enables Claude Code to request human feedback through Slack during task execution. The project is currently in specification phase with a detailed implementation plan in `claude-mcp-slack-spec.md`.

## Key Architecture Decisions

### Multi-User and Multi-Session Support
- Each user gets dedicated Slack channels (e.g., #claude-jorge-main, #claude-jorge-12345)
- Sessions are uniquely identified and managed independently
- Port assignment is dynamic (3000-4000 range) per session

### Hybrid Communication System
- Primary: Webhook-based for real-time responses (using cloudflared tunnel)
- Fallback: Polling mechanism when webhooks are unavailable
- Automatic switchover between modes

### Zero-Configuration Goal
- After initial setup, the system auto-detects users
- Automatically creates channels and manages sessions
- Stores configuration in `~/.claude-mcp-slack-feedback/config.json`

## Development Commands

Once implemented, the project will use:

```bash
# Development
npm run dev        # Run in development mode with auto-reload
npm run build      # Build TypeScript to JavaScript
npm test           # Run all tests
npm run lint       # Run linting
npm run typecheck  # Run TypeScript type checking

# Installation
./scripts/install.sh  # Automated installation script
```

## Project Structure

The implementation should follow this structure:

```
src/
├── index.ts            # MCP server entry point
├── slack-client.ts     # Slack API wrapper with rate limiting
├── session-manager.ts  # Multi-session orchestration
├── tunnel-manager.ts   # Cloudflared tunnel management
├── config-manager.ts   # Configuration persistence
└── types.ts           # TypeScript interfaces
```

## Critical Implementation Notes

### MCP Tools to Implement
1. `setup_slack_config` - Initial Slack workspace configuration
2. `ask_feedback` - Send questions to Slack
3. `update_progress` - Update thread with progress
4. `get_responses` - Retrieve responses (webhook or polling)
5. `list_sessions` - Show active sessions

### Slack App Requirements
The Slack app needs these OAuth scopes:
- `channels:write` - Create channels
- `chat:write` - Send messages
- `channels:read` - List channels
- `users:read` - Get user info
- `users:read.email` - Match by email

### Rate Limiting
Implement exponential backoff for Slack API calls to handle rate limits gracefully.

### Session Management
- Sessions expire after 24 hours of inactivity
- Cleanup old channels after session expiry
- Handle concurrent sessions per user

## Testing Strategy

Focus testing on:
- Session isolation and concurrent operation
- Webhook/polling mode switching
- Slack API error handling and retries
- Configuration persistence and migration
- Port assignment collision handling

## Implementation Phases

Follow the 6-phase implementation plan from the specification:
1. Core MCP server with session management
2. Slack integration and channel creation
3. Webhook server with tunnel setup
4. Polling fallback mechanism
5. Auto-configuration and installers
6. Testing and deployment preparation

## Important Considerations

- Never commit Slack tokens or sensitive configuration
- Always validate user input in MCP tools
- Implement proper error handling for network failures
- Ensure graceful degradation when Slack is unavailable
- Test with multiple concurrent users and sessions

## Development Best Practices

- Siempre que sea posible introduce pruebas y ejecutalas para validar que los pasos que vas dando quedan consolidados.

## Additional Notes
- Este MCP es para claude Code, *no para Claude Desktop*

## MCP Environment Notes
- El MCP mcp__claude-mcp-slack-feedback-dev es el que estamos construyendo ahora. Reiniciando este chat se deben ver los cambios. El MCP mcp__claude-mcp-slack-feedback-prod es una versión más estable previa (sin los cambios en curso).