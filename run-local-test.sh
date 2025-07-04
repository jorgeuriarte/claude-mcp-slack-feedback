#!/bin/bash

# Script para ejecutar el MCP localmente con las nuevas mejoras

echo "🚀 Iniciando MCP local con polling mejorado..."
echo "   - Polling: 3s intensivo por 1 minuto, luego 15s pausa"
echo "   - Detecta mensajes en threads Y canal"
echo "   - Webhook: ${CLOUD_FUNCTION_URL:-https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app}"
echo ""

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# Ejecutar el MCP
node dist/index.js