#!/bin/bash

echo "=== Prueba completa del sistema MCP Slack con Cloud Polling ==="
echo ""

# Configurar variables
# El token debe estar configurado como variable de entorno
if [ -z "$SLACK_BOT_TOKEN" ]; then
    echo "❌ Error: SLACK_BOT_TOKEN no está configurado"
    echo "Configúralo con: export SLACK_BOT_TOKEN='tu-token-aqui'"
    exit 1
fi
export SLACK_WORKSPACE_URL="gailen.slack.com"
export CLOUD_FUNCTION_URL="https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app"

# 1. Verificar Cloud Function
echo "1. Verificando Cloud Function..."
HEALTH=$(curl -s "$CLOUD_FUNCTION_URL/health" | jq -r '.status')
if [ "$HEALTH" = "healthy" ]; then
    echo "   ✅ Cloud Function está activa"
    ACTIVE_RESPONSES=$(curl -s "$CLOUD_FUNCTION_URL/health" | jq -r '.activeResponses')
    echo "   📊 Respuestas activas en memoria: $ACTIVE_RESPONSES"
else
    echo "   ❌ Cloud Function no responde"
    exit 1
fi

# 2. Compilar el proyecto
echo ""
echo "2. Compilando proyecto..."
npm run build
if [ $? -eq 0 ]; then
    echo "   ✅ Compilación exitosa"
else
    echo "   ❌ Error en compilación"
    exit 1
fi

# 3. Verificar configuración
echo ""
echo "3. Configuración actual:"
echo "   - Slack Workspace: $SLACK_WORKSPACE_URL"
echo "   - Cloud Function: $CLOUD_FUNCTION_URL"
echo "   - Modo: Cloud Polling (webhook + polling)"

# 4. Iniciar servidor MCP
echo ""
echo "4. Iniciando servidor MCP..."
echo ""
echo "🚀 El servidor MCP está listo para:"
echo "   - Enviar mensajes directamente a Slack"
echo "   - Recibir respuestas vía Cloud Function polling"
echo ""
echo "📝 Para probar:"
echo "   1. Abre Claude Desktop"
echo "   2. Usa el comando 'setup_slack_config' si es necesario"
echo "   3. Usa 'ask_feedback' para enviar una pregunta"
echo "   4. Responde en Slack"
echo "   5. Las respuestas llegarán vía Cloud Function"
echo ""

# Ejecutar el servidor
npm start