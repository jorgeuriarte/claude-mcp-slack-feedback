# Añadir Scope de Reacciones

## Por qué lo necesitamos
Las reacciones emoji son perfectas para confirmar respuestas de forma no invasiva:
- ✅ Confirmar que recibimos una respuesta
- 🤔 Indicar que no estamos seguros
- ❓ Pedir aclaración
- 👀 Indicar que estamos procesando

## Cómo añadirlo

### Opción 1: Actualizar el Manifest (Recomendado)
1. Ve a https://api.slack.com/apps/A093FLET1S9/app-manifest
2. El manifest ya incluye `reactions:write` en nuestro archivo
3. Haz clic en "Save Changes"
4. Slack te pedirá reinstalar la app

### Opción 2: Manualmente
1. Ve a https://api.slack.com/apps/A093FLET1S9/oauth
2. En "Bot Token Scopes", busca "Add an OAuth Scope"
3. Añade `reactions:write`
4. Reinstala la app en tu workspace

## Uso en el código

```javascript
// Confirmar respuesta
await slackClient.reactions.add({
  channel: message.channel,
  timestamp: message.ts,
  name: 'white_check_mark'
});

// Indicar procesamiento
await slackClient.reactions.add({
  channel: message.channel,
  timestamp: message.ts,
  name: 'eyes'
});

// Pedir aclaración
await slackClient.reactions.add({
  channel: message.channel,
  timestamp: message.ts,
  name: 'question'
});
```

## Flujo propuesto

1. Usuario responde en el canal
2. Claude analiza si es respuesta válida
3. Si es válida → ✅
4. Si no está seguro → 🤔 + pregunta de confirmación
5. Si necesita aclaración → ❓

## Beneficios
- Feedback inmediato no invasivo
- El usuario sabe que su mensaje fue recibido
- Crea un historial visual en Slack
- No genera ruido adicional en el canal