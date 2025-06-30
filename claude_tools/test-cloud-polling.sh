#!/bin/bash

echo "=== Test de Cloud Polling ==="
echo ""

# Test 1: Verificar que el webhook funciona
echo "1. Simulando webhook de Slack..."
WEBHOOK_RESPONSE=$(curl -X POST https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/slack/events \
  -H "Content-Type: application/json" \
  -H "x-slack-signature: v0=test" \
  -H "x-slack-request-timestamp: $(date +%s)" \
  -d '{
    "type": "event_callback",
    "event": {
      "type": "message",
      "user": "U026D8F8J",
      "text": "Respuesta de prueba via webhook",
      "ts": "'$(date +%s.%N)'",
      "thread_ts": "1751314261.194429",
      "channel": "C093FLV2MK7",
      "channel_name": "claude-jorge-main"
    }
  }' -w "\nHTTP Status: %{http_code}\n" 2>/dev/null)

echo "$WEBHOOK_RESPONSE"
echo ""

# Test 2: Verificar polling
echo "2. Verificando respuestas almacenadas..."
curl -s "https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/responses/main/1751314261.194429" | jq .

echo ""
echo "3. Health check..."
curl -s https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/health | jq .