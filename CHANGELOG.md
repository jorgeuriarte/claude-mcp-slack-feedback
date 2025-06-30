# Changelog

## [1.3.1] - 2025-06-30

### Changed
- Made cloudflared an optional dependency
- The MCP server now defaults to polling mode when cloudflared is not available
- Automatic detection of cloudflared availability on startup
- Improved fallback behavior when webhook setup fails

### Improved
- Better error messages when cloudflared is not installed
- Updated installation script to clearly indicate cloudflared is optional
- Enhanced documentation to reflect polling as the default mode

### Technical
- Modified `TunnelManager` to check for cloudflared before attempting to start
- Added static `isAvailable()` method to check cloudflared availability
- Updated tests to handle the new cloudflared detection logic
- Version bumped to 1.3.1

## [1.3.0] - Previous release

### Added
- Visual session identification with emojis and labels
- New set_session_label tool for custom naming
- Rich Slack blocks formatting
- Each session has unique emoji and display name

## [1.2.1] - Previous release

### Added
- Bot attempts to auto-join public channels
- Better error messages when not channel member