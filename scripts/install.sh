#!/bin/bash

set -e

echo "======================================"
echo "Claude MCP Slack Feedback Installer"
echo "======================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check Node.js version
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        echo "Please install Node.js 18+ from https://nodejs.org"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d 'v' -f 2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d '.' -f 1)
    
    if [ $NODE_MAJOR -lt 18 ]; then
        print_error "Node.js version $NODE_VERSION is too old"
        echo "Please upgrade to Node.js 18 or higher"
        exit 1
    fi
    
    print_success "Node.js version $NODE_VERSION detected"
}

# Check if cloudflared is installed
check_cloudflared() {
    if command -v cloudflared &> /dev/null; then
        print_success "cloudflared is already installed"
        return 0
    fi
    
    print_warning "cloudflared is not installed"
    echo
    echo "cloudflared enables webhook mode for instant responses."
    echo "Without it, the MCP server will use polling mode (checks every few seconds)."
    echo
    read -p "Would you like to install cloudflared for webhook support? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_cloudflared
    else
        print_success "Skipping cloudflared installation"
        print_warning "The MCP server will use polling mode by default"
        echo "You can install cloudflared later if you want webhook support."
    fi
}

# Install cloudflared based on platform
install_cloudflared() {
    echo "Installing cloudflared..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install cloudflare/cloudflare/cloudflared
            print_success "cloudflared installed via Homebrew"
        else
            print_error "Homebrew not found"
            echo "Please install Homebrew from https://brew.sh or install cloudflared manually"
            echo "Manual installation: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        ARCH=$(uname -m)
        if [[ "$ARCH" == "x86_64" ]]; then
            ARCH="amd64"
        elif [[ "$ARCH" == "aarch64" ]]; then
            ARCH="arm64"
        fi
        
        DOWNLOAD_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}"
        
        echo "Downloading cloudflared for Linux ${ARCH}..."
        sudo wget -O /usr/local/bin/cloudflared "$DOWNLOAD_URL"
        sudo chmod +x /usr/local/bin/cloudflared
        
        print_success "cloudflared installed to /usr/local/bin/cloudflared"
    else
        print_error "Unsupported operating system: $OSTYPE"
        echo "Please install cloudflared manually from:"
        echo "https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation"
        exit 1
    fi
}

# Build the project
build_project() {
    echo "Building the project..."
    npm install
    npm run build
    print_success "Project built successfully"
}

# Setup Claude configuration
setup_claude_config() {
    CLAUDE_CONFIG_DIR="$HOME/.config/claude"
    MCP_CONFIG_FILE="$CLAUDE_CONFIG_DIR/mcp-servers.json"
    
    echo
    echo "Setting up Claude configuration..."
    
    # Create config directory if it doesn't exist
    mkdir -p "$CLAUDE_CONFIG_DIR"
    
    # Check if mcp-servers.json exists
    if [ -f "$MCP_CONFIG_FILE" ]; then
        print_warning "Found existing Claude MCP configuration"
        
        # Check if our server is already configured
        if grep -q "claude-mcp-slack-feedback" "$MCP_CONFIG_FILE"; then
            print_warning "claude-mcp-slack-feedback is already configured"
            read -p "Would you like to update the configuration? (y/n) " -n 1 -r
            echo
            
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_success "Configuration unchanged"
                return 0
            fi
        fi
        
        # Backup existing config
        cp "$MCP_CONFIG_FILE" "$MCP_CONFIG_FILE.backup"
        print_success "Backed up existing configuration to $MCP_CONFIG_FILE.backup"
    else
        # Create new config file with empty object
        echo '{}' > "$MCP_CONFIG_FILE"
    fi
    
    # Get the absolute path to the built server
    SERVER_PATH="$(cd "$(dirname "$0")/.." && pwd)/dist/index.js"
    
    # Update configuration using Node.js
    node -e "
    const fs = require('fs');
    const configPath = '$MCP_CONFIG_FILE';
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    config['claude-mcp-slack-feedback'] = {
        command: 'node',
        args: ['$SERVER_PATH'],
        env: {}
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Configuration updated successfully');
    "
    
    print_success "Added claude-mcp-slack-feedback to Claude configuration"
    echo
    echo "Server configured at: $SERVER_PATH"
}

# Main installation flow
main() {
    echo "Starting installation..."
    echo
    
    # Check prerequisites
    check_node
    check_cloudflared
    echo
    
    # Build project
    build_project
    echo
    
    # Setup Claude configuration
    setup_claude_config
    echo
    
    print_success "Installation complete!"
    echo
    echo "Next steps:"
    echo "1. Create a Slack app:"
    echo "   a) Go to https://api.slack.com/apps"
    echo "   b) Click 'Create New App' → 'From an app manifest'"
    echo "   c) Select your workspace"
    echo "   d) Choose YAML and paste the contents of slack-app-manifest.yml"
    echo "   e) Create the app"
    echo
    echo "2. Install the app to your workspace:"
    echo "   - Click 'Install to Workspace'"
    echo "   - Copy the Bot User OAuth Token (starts with xoxb-)"
    echo
    echo "3. Restart Claude Desktop"
    echo
    echo "4. In Claude, configure your token:"
    echo "   setup_slack_config with bot token \"xoxb-your-token-here\""
    echo
    if command -v cloudflared &> /dev/null; then
        echo "cloudflared is installed - webhook mode will be attempted automatically."
        echo "If webhook setup fails, the bot will fall back to polling mode."
    else
        echo "The bot will use polling mode (no cloudflared detected)."
        echo "This works perfectly fine, responses are checked every few seconds."
    fi
}

# Run main function
main