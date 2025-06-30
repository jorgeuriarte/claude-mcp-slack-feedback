#!/bin/bash

# Script para probar MCP local con Cloud Polling

echo "Configurando entorno para prueba local con Cloud Polling..."

# Configurar variables de entorno
# export SLACK_BOT_TOKEN="tu-token-aqui"  # Configura tu token antes de ejecutar
export SLACK_WORKSPACE_URL="gailen.slack.com"
export CLOUD_FUNCTION_URL="https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app"

# Verificar que el token esté configurado
if [ -z "$SLACK_BOT_TOKEN" ]; then
    echo "❌ Error: SLACK_BOT_TOKEN no está configurado"
    echo "Configúralo con: export SLACK_BOT_TOKEN='tu-token-aqui'"
    exit 1
fi

echo "Configuración:"
echo "- Token de Slack: Configurado"
echo "- Workspace: $SLACK_WORKSPACE_URL"
echo "- Cloud Function: $CLOUD_FUNCTION_URL"
echo ""

# Verificar que la Cloud Function esté activa
echo "Verificando Cloud Function..."
HEALTH_CHECK=$(curl -s "$CLOUD_FUNCTION_URL/health" | jq -r '.status')

if [ "$HEALTH_CHECK" = "healthy" ]; then
    echo "✅ Cloud Function está funcionando correctamente"
else
    echo "❌ Cloud Function no responde. Estado: $HEALTH_CHECK"
    exit 1
fi

echo ""
echo "Iniciando servidor MCP local..."
echo "El servidor usará Cloud Polling para obtener respuestas"
echo ""

# Ejecutar el servidor
npm start