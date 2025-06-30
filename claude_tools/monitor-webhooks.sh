#!/bin/bash

echo "=== Monitor de Webhooks en tiempo real ==="
echo "Presiona Ctrl+C para detener"
echo ""

LAST_CHECK=$(date +%s)

while true; do
    NOW=$(date +%s)
    
    # Obtener logs desde el último check
    LOGS=$(gcloud functions logs read claude-mcp-slack-feedback \
        --region=europe-west1 \
        --limit=50 \
        --format="value(timestamp,text)" \
        --filter="timestamp>\"$(date -u -d @$LAST_CHECK +'%Y-%m-%dT%H:%M:%SZ')\"" 2>/dev/null)
    
    if [ ! -z "$LOGS" ]; then
        echo "--- $(date) ---"
        echo "$LOGS" | grep -v "health" | grep -v "^$"
        echo ""
    fi
    
    LAST_CHECK=$NOW
    sleep 3
done