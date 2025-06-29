#!/bin/bash

echo "🧪 Probando modo webhook del MCP de Slack..."
echo

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}1. Verificando cloudflared...${NC}"
if which cloudflared > /dev/null; then
    echo -e "${GREEN}✓ cloudflared está instalado${NC}"
    cloudflared --version
else
    echo "❌ cloudflared no está instalado"
    echo "Instálalo con: brew install cloudflared"
    exit 1
fi

echo
echo -e "${YELLOW}2. Iniciando servidor MCP en modo desarrollo...${NC}"
echo "El servidor intentará crear un túnel con cloudflared"
echo

# Iniciar el servidor en background
npm run dev &
MCP_PID=$!

# Esperar a que el servidor esté listo
sleep 5

echo
echo -e "${YELLOW}3. El servidor MCP está corriendo (PID: $MCP_PID)${NC}"
echo "Cuando envíes un mensaje a Slack:"
echo "- Si el modo es 'webhook', recibirás las respuestas en tiempo real"
echo "- Si el modo es 'polling', necesitarás llamar a get_responses"
echo
echo -e "${YELLOW}4. Para detener el servidor, ejecuta:${NC}"
echo "kill $MCP_PID"
echo
echo "Puedes probar el MCP en otra terminal con Claude Code"