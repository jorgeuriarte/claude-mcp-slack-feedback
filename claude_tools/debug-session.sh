#!/bin/bash

echo "==================================="
echo "Debug de Sesiones y Canales"
echo "==================================="
echo

# Ver la configuración actual
echo "1. Configuración guardada:"
cat ~/.claude-mcp-slack-feedback/config.json | jq '.'

echo
echo "2. Para depurar en Claude Code, ejecuta estos comandos:"
echo
echo "   a) Lista las sesiones activas:"
echo "      usa mcp__claude-mcp-slack-feedback__list_sessions"
echo
echo "   b) Envía una pregunta y observa el canal:"
echo "      usa mcp__claude-mcp-slack-feedback__ask_feedback con question \"Test - ¿en qué canal estoy?\""
echo
echo "3. El sistema debería:"
echo "   - Detectar tu usuario automáticamente"
echo "   - Crear un canal nuevo para cada sesión (ej: #claude-jorge-abc123)"
echo "   - Reusar el canal si la sesión ya existe"
echo

# Verificar variables de entorno
echo "4. Variables de entorno:"
echo "   USER: $USER"
echo "   CLAUDE_USER_EMAIL: ${CLAUDE_USER_EMAIL:-no configurado}"
echo

echo "Si el canal muestra un ID en lugar de un nombre, es porque:"
echo "- Está usando un canal existente que no fue creado por el bot"
echo "- O hay un problema con la creación del canal"