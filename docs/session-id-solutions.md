# Soluciones para Session ID

## Opción 1: Mapeo threadTs → sessionId (Recomendada)

Cuando el MCP envía un mensaje:
1. Recibe el `ts` del mensaje enviado
2. Almacena localmente: `threadTs → sessionId`
3. Al hacer polling, usa el threadTs para buscar respuestas

```javascript
// En MCP cuando envía mensaje:
const result = await slack.postMessage(...);
sessionManager.mapThreadToSession(result.ts, sessionId);

// Al hacer polling:
const threadTs = sessionManager.getThreadForSession(sessionId);
const responses = await pollResponses(sessionId, threadTs);
```

## Opción 2: Incluir sessionId en el webhook

El MCP podría incluir el sessionId en cada request de polling:
```
GET /responses/{sessionId}?threadTs={threadTs}
```

El webhook almacenaría bajo ambas claves.

## Opción 3: Usar conversations.history API

En lugar de webhooks, el MCP podría:
1. Recordar el threadTs de cada pregunta
2. Usar `conversations.history` para obtener respuestas
3. No necesita webhooks en absoluto

## Para mensajes fuera del thread

Si alguien responde en el canal (no en thread):
1. El webhook puede almacenar mensajes sin `thread_ts`
2. El MCP analiza si parecen respuestas relevantes
3. Criterios:
   - Tiempo cercano a la pregunta (< 5 min)
   - Menciona al bot o usuario
   - Contexto relevante

## Implementación propuesta

1. **Corto plazo**: Mapeo threadTs → sessionId en el MCP
2. **Mediano plazo**: Análisis inteligente de mensajes del canal
3. **Largo plazo**: Modo híbrido que combina webhooks + API