#!/bin/bash

echo "==================================="
echo "Prueba rápida del MCP de Slack"
echo "==================================="
echo

# Primero verificamos que el MCP está compilado
if [ ! -f "dist/index.js" ]; then
    echo "❌ El proyecto no está compilado. Ejecutando npm run build..."
    npm run build
fi

echo "✅ MCP compilado y listo"
echo

echo "Ahora ejecuta estos comandos en Claude Code:"
echo
echo "1. claude"
echo
echo "2. Una vez dentro, escribe:"
echo "   Lista las herramientas MCP disponibles"
echo
echo "3. Si ves las herramientas de Slack, configura con:"
echo "   usa setup_slack_config con bot token \"xoxb-tu-token-aqui\""
echo
echo "4. Prueba enviando una pregunta:"
echo "   usa ask_feedback para preguntar \"¿Está funcionando el bot?\""
echo