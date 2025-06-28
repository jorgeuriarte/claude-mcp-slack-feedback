#!/bin/bash

echo "Probando MCP de Slack..."
echo

# Test básico para verificar que las herramientas están disponibles
claude --model claude-3-5-sonnet-20241022 <<EOF
Lista las herramientas MCP disponibles
EOF