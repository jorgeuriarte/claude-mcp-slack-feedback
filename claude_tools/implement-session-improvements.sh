#!/bin/bash

# Script para implementar las mejoras solicitadas en el sistema de feedback de Slack

set -e

echo "🚀 Implementando mejoras en el sistema de feedback de Slack..."

# 1. Crear backup de los archivos que vamos a modificar
echo "📦 Creando backup de archivos..."
cp ../src/types.ts ../src/types.ts.backup
cp ../src/index.ts ../src/index.ts.backup
cp ../src/slack-client.ts ../src/slack-client.ts.backup
cp ../src/session-manager.ts ../src/session-manager.ts.backup

echo "✅ Backup creado"

# 2. Aplicar las modificaciones
echo "🔧 Aplicando modificaciones..."

# Las modificaciones se harán directamente desde Claude Code

echo "✅ Script de preparación completado"
echo ""
echo "📋 Próximos pasos:"
echo "1. Modificar types.ts para añadir sessionContact a Session"
echo "2. Añadir herramienta set_session_contact en index.ts"
echo "3. Modificar ask_feedback para detectar sesiones sin configurar"
echo "4. Implementar confirmación automática en get_responses"
echo "5. Actualizar formato de mensajes con menciones"