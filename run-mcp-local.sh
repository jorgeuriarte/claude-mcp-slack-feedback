#!/bin/bash

# Script para ejecutar el MCP localmente con todas las variables necesarias

echo "🚀 Iniciando MCP local con configuración completa..."

# Verificar que existe el build
if [ ! -f "dist/index.js" ]; ]; then
    echo "❌ No se encuentra dist/index.js. Ejecutando build..."
    npm run build
fi

# Configurar variables de entorno
export CLOUD_FUNCTION_URL="https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app"
export SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN}"
export SLACK_WORKSPACE_URL="${SLACK_WORKSPACE_URL}"

echo "📋 Configuración:"
echo "  CLOUD_FUNCTION_URL: $CLOUD_FUNCTION_URL"
echo "  SLACK_BOT_TOKEN: ${SLACK_BOT_TOKEN:0:10}..."
echo "  SLACK_WORKSPACE_URL: $SLACK_WORKSPACE_URL"

# Ejecutar el servidor MCP
echo ""
echo "✅ Iniciando servidor MCP..."
node dist/index.js