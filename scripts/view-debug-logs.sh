#!/bin/bash

# Script to view debug logs from MCP server

LOG_DIR="$HOME/.claude-mcp-slack-feedback/logs"

if [ ! -d "$LOG_DIR" ]; then
    echo "❌ Log directory not found: $LOG_DIR"
    echo "The MCP server may not have been run yet."
    exit 1
fi

# Find the most recent log file
LATEST_LOG=$(ls -t "$LOG_DIR"/mcp-*.log 2>/dev/null | head -1)

if [ -z "$LATEST_LOG" ]; then
    echo "❌ No log files found in $LOG_DIR"
    exit 1
fi

echo "📋 Viewing latest log: $LATEST_LOG"
echo "================================"
echo ""

# Show debug messages and polling info
echo "🔍 DEBUG and POLLING messages:"
echo "------------------------------"
grep -E "\[DEBUG\]|\[POLLING|\[CLOUD POLLING" "$LATEST_LOG" | tail -50

echo ""
echo "🔄 Session and mode information:"
echo "--------------------------------"
grep -E "Session.*mode|Using.*polling|Cloud Run architecture" "$LATEST_LOG" | tail -20

echo ""
echo "⚠️  Recent errors (if any):"
echo "-------------------------"
grep -E "ERROR|Error|error" "$LATEST_LOG" | tail -10

echo ""
echo "💡 To see full log: tail -f $LATEST_LOG"
echo "💡 To see all DEBUG: grep DEBUG $LATEST_LOG"