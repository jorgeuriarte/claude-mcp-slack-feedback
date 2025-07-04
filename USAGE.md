# Uso del MCP Slack Feedback con Cloud Polling

## Configuración rápida

### 1. Para Claude Code

El archivo `.mcp.json` ya está incluido en la raíz del proyecto. Solo necesitas:

1. Configurar las variables de entorno:
   ```bash
   export SLACK_BOT_TOKEN="tu-token-de-slack"
   export SLACK_WORKSPACE_URL="tu-workspace.slack.com"
   ```

2. Abrir el proyecto con Claude Code y el MCP se cargará automáticamente.

El archivo `.mcp.json` incluido contiene:
```json
{
  "mcpServers": {
    "claude-mcp-slack-feedback": {
      "command": "node",
      "args": ["./dist/index.js"],
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
        "SLACK_WORKSPACE_URL": "${SLACK_WORKSPACE_URL}",
        "CLOUD_FUNCTION_URL": "https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app"
      }
    }
  }
}
```

### 2. Para pruebas locales

```bash
# Configurar token
export SLACK_BOT_TOKEN="tu-token-de-slack"

# Ejecutar
./test-complete-system.sh
```

## Cómo funciona

1. **Envío de mensajes**: MCP → Slack API (directo)
2. **Recepción de respuestas**: Slack → Cloud Function (webhook)
3. **Obtención de respuestas**: MCP → Cloud Function (polling)

## Comandos disponibles en Claude

- `setup_slack_config` - Configurar token de Slack (solo primera vez)
- `ask_feedback` - Enviar pregunta a Slack
- `update_progress` - Actualizar progreso en thread
- `list_sessions` - Ver sesiones activas

## Verificación del sistema

### Cloud Function
```bash
curl https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/health
```

### Ver logs
```bash
gcloud functions logs read claude-mcp-slack-feedback --region=europe-west1 --limit=20
```

## Troubleshooting

### El webhook no recibe eventos
1. Verifica en Slack App → Event Subscriptions que la URL esté verificada
2. Asegúrate de que los eventos estén suscritos (message.channels, etc.)

### No llegan respuestas
1. Verifica que CLOUD_FUNCTION_URL esté configurada
2. Revisa los logs de Cloud Function para ver si llegan webhooks
3. Verifica que el canal de Slack tenga el formato correcto (#claude-usuario-sesion)

### Error de autenticación
1. Verifica que el SLACK_BOT_TOKEN sea correcto
2. Asegúrate de que el bot esté invitado al canal