# Development Setup

This document explains how to set up the development environment for `claude-mcp-slack-feedback`.

## Production vs Development Versions

### Production (Default)

When you open a new Claude Code session, it uses the globally installed version from GitHub:

```bash
# Install/update the production version
./scripts/install-from-git.sh
```

This installs the latest main branch version to `/opt/homebrew/lib/node_modules/claude-mcp-slack-feedback`.

### Development (Beta Testing)

To use your local development version temporarily:

1. **Option A: Use npm link (Recommended for development)**
   ```bash
   # In your development directory
   npm run build
   npm link
   
   # This creates a symlink from the global location to your local version
   # Now Claude Code will use your local version
   
   # To revert back to production version:
   npm unlink -g claude-mcp-slack-feedback
   ./scripts/install-from-git.sh
   ```

2. **Option B: Create a separate Claude settings file**
   ```bash
   # Create a beta configuration
   cp ~/.claude/mcp_settings.json ~/.claude/mcp_settings_beta.json
   
   # Edit mcp_settings_beta.json to point to your local dist:
   # "args": ["/path/to/your/project/dist/index.js"]
   
   # Temporarily use the beta config:
   mv ~/.claude/mcp_settings.json ~/.claude/mcp_settings_prod.json
   mv ~/.claude/mcp_settings_beta.json ~/.claude/mcp_settings.json
   
   # Revert to production:
   mv ~/.claude/mcp_settings.json ~/.claude/mcp_settings_beta.json
   mv ~/.claude/mcp_settings_prod.json ~/.claude/mcp_settings.json
   ```

## Development Workflow

1. Make changes to the TypeScript source in `src/`
2. Build the project: `npm run build`
3. If using npm link, changes are immediately available
4. Test with Claude Code
5. When ready to deploy, commit and push to GitHub
6. Run `./scripts/install-from-git.sh` to update the production version

## Important Notes

- Always build (`npm run build`) after making changes
- The production version is installed with `--ignore-scripts` to avoid cloudflared postinstall issues
- Keep your local development environment separate from the production installation
- Test thoroughly before pushing changes that will affect the production version