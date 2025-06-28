#!/bin/bash

echo "Reseteando sesiones..."

# Backup config actual
cp ~/.claude-mcp-slack-feedback/config.json ~/.claude-mcp-slack-feedback/config.backup.json

# Limpiar solo las sesiones, manteniendo la config de Slack y usuarios
cat ~/.claude-mcp-slack-feedback/config.json | jq '.sessions = []' > ~/.claude-mcp-slack-feedback/config.tmp.json
mv ~/.claude-mcp-slack-feedback/config.tmp.json ~/.claude-mcp-slack-feedback/config.json

echo "✅ Sesiones limpiadas. La próxima vez creará canales con nombres correctos."
echo
echo "Canales esperados:"
echo "- Primera sesión: #claude-jorg-abc123 (6 chars de session ID)"
echo "- Canal principal: #claude-jorge-main"