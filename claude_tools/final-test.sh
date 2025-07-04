#!/bin/bash

echo "=== Test Final del Sistema Cloud Polling ==="
echo ""

# 1. Enviar mensaje
echo "1. Enviando mensaje a Slack..."
# export SLACK_BOT_TOKEN="" # Set this in your environment
TIMESTAMP=$(node -e "
import { WebClient } from '@slack/web-api';
const client = new WebClient(process.env.SLACK_BOT_TOKEN);
client.chat.postMessage({
  channel: 'C093FLV2MK7',
  text: '🎯 TEST FINAL: Por favor responde a este mensaje para probar el sistema completo'
}).then(r => console.log(r.ts));
")

echo "Mensaje enviado con timestamp: $TIMESTAMP"
echo ""
echo "👉 POR FAVOR RESPONDE EN SLACK AHORA"
echo ""

# 2. Esperar 10 segundos
echo "Esperando 10 segundos para que respondas..."
sleep 10

# 3. Verificar webhooks
echo ""
echo "2. Verificando logs de webhooks..."
gcloud functions logs read claude-mcp-slack-feedback --region=europe-west1 --limit=20 | grep -E "(Stored response|Processing Slack|channel)" | tail -5

# 4. Verificar respuestas
echo ""
echo "3. Verificando respuestas almacenadas..."
curl -s "https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/responses/main/$TIMESTAMP" | jq .

echo ""
echo "4. Health check..."
curl -s https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/health | jq '.activeResponses'