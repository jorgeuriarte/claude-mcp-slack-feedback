#!/bin/bash

# Test script for local development
# This script helps test the MCP server locally without Claude

set -e

echo "Claude MCP Slack Feedback - Local Test"
echo "======================================"
echo

# Build the project first
echo "Building project..."
npm run build

# Create a test environment
export CLAUDE_USER_EMAIL="${CLAUDE_USER_EMAIL:-test@example.com}"

# Function to send MCP request
send_request() {
    local method=$1
    local params=$2
    
    echo "{\"jsonrpc\":\"2.0\",\"method\":\"$method\",\"params\":$params,\"id\":1}"
}

# Start the server in background
echo "Starting MCP server..."
node dist/index.js &
SERVER_PID=$!

# Give it time to start
sleep 2

echo
echo "Server started with PID: $SERVER_PID"
echo

# Function to cleanup on exit
cleanup() {
    echo
    echo "Shutting down server..."
    kill $SERVER_PID 2>/dev/null || true
    exit
}

trap cleanup EXIT INT TERM

echo "Available commands:"
echo "1. list    - List available tools"
echo "2. setup   - Setup Slack configuration"
echo "3. ask     - Ask a feedback question"
echo "4. get     - Get responses"
echo "5. session - List sessions"
echo "6. quit    - Exit"
echo

while true; do
    read -p "> " cmd
    
    case $cmd in
        list)
            send_request "tools/list" "{}" | node dist/index.js
            ;;
        setup)
            read -p "Bot token: " token
            send_request "tools/call" "{\"name\":\"setup_slack_config\",\"arguments\":{\"botToken\":\"$token\"}}" | node dist/index.js
            ;;
        ask)
            read -p "Question: " question
            send_request "tools/call" "{\"name\":\"ask_feedback\",\"arguments\":{\"question\":\"$question\"}}" | node dist/index.js
            ;;
        get)
            send_request "tools/call" "{\"name\":\"get_responses\",\"arguments\":{}}" | node dist/index.js
            ;;
        session)
            send_request "tools/call" "{\"name\":\"list_sessions\",\"arguments\":{}}" | node dist/index.js
            ;;
        quit|exit)
            break
            ;;
        *)
            echo "Unknown command: $cmd"
            ;;
    esac
    echo
done