# Análisis de Respuestas con LLM

## Concepto
En lugar de un sistema de scoring complejo, el MCP usa su propio LLM para determinar si un mensaje en el canal es una respuesta válida a su pregunta.

## Implementación Simple

```javascript
// En el webhook - almacenar TODOS los mensajes del canal temporalmente
async function handleChannelMessage(event) {
  if (!event.thread_ts && !event.bot_id) {
    // Almacenar mensaje del canal con timestamp
    const key = `channel:${event.channel}:${event.ts}`;
    channelMessages.set(key, {
      timestamp: Date.now(),
      message: event
    });
  }
}

// En el MCP - analizar mensajes del canal
async function checkChannelResponses(question, threadTs, timeWindow = 120) {
  const channelMessages = await cloudClient.getChannelMessages(
    session.channelId, 
    threadTs, 
    timeWindow
  );
  
  if (channelMessages.length === 0) return null;
  
  // El LLM analiza si algún mensaje es respuesta a la pregunta
  const analysis = await analyzeMessages({
    question: question,
    messages: channelMessages,
    context: {
      sessionLabel: session.sessionLabel,
      expectedOptions: options,
      timeElapsed: channelMessages.map(m => m.timeFromQuestion)
    }
  });
  
  return analysis.bestMatch;
}

async function analyzeMessages({ question, messages, context }) {
  // El propio Claude analiza
  const prompt = `
    I asked this question in Slack: "${question}"
    
    These messages were posted in the channel shortly after:
    ${messages.map(m => `
      - User ${m.user} (${m.timeFromQuestion}s later): "${m.text}"
    `).join('\n')}
    
    Context:
    - Expected options: ${context.expectedOptions?.join(', ') || 'any relevant response'}
    - Session: ${context.sessionLabel}
    
    Which message (if any) is most likely a response to my question?
    Consider:
    - Timing (sooner is more likely)
    - Content relevance
    - User patterns (some users might answer more often)
    - Whether it matches expected options
    
    Respond with:
    {
      "isResponse": true/false,
      "confidence": "high/medium/low",
      "messageIndex": n,
      "reasoning": "brief explanation"
    }
  `;
  
  // Claude analiza y decide
  return await llm.analyze(prompt);
}
```

## Ejemplo de Flujo

1. **Claude pregunta en thread**:
   ```
   ¿Debo usar PostgreSQL o MongoDB para este proyecto?
   ```

2. **Mensajes en el canal** (próximos 2 minutos):
   ```
   [10s] Jorge: "postgres"
   [15s] María: "hey Jorge, ¿viste el PR?"
   [30s] Carlos: "yo usaría mongo para eso"
   [45s] Jorge: "sí, lo reviso en un rato"
   ```

3. **Claude analiza**:
   ```json
   {
     "isResponse": true,
     "confidence": "high",
     "messageIndex": 0,
     "reasoning": "Jorge's 'postgres' directly answers the PostgreSQL vs MongoDB question, posted immediately after (10s)"
   }
   ```

4. **Claude confirma**:
   - ✅ Reacciona al mensaje de Jorge
   - En el thread: "Entendido, usaré PostgreSQL"

## Ventajas del Enfoque LLM

1. **Comprensión Natural**: Entiende variaciones ("pg", "postgres", "PostgreSQL", "usa postgres")
2. **Contexto**: Puede distinguir conversaciones paralelas
3. **Adaptable**: No necesita reglas predefinidas
4. **Inteligente**: Entiende respuestas indirectas ("yo siempre uso postgres para estos casos")

## Configuración de Seguridad

```javascript
// Para evitar falsos positivos
const channelResponseConfig = {
  enabled: true,
  maxTimeWindow: 120,          // Solo mensajes en 2 minutos
  requireHighConfidence: true,  // Solo si LLM está seguro
  confirmBeforeAction: true,    // Siempre confirmar con emoji
  ignoreIfThreadActive: true    // Si hay respuestas en thread, ignorar canal
};
```

## Casos Edge

1. **Múltiples respuestas contradictorias**:
   - LLM puede preguntar: "Veo respuestas diferentes, ¿cuál debo seguir?"

2. **Respuesta ambigua**:
   - Si confidence es "low", ignorar

3. **Conversaciones cruzadas**:
   - LLM es bueno distinguiendo contextos

## Implementación Minimal

Para empezar simple:

```javascript
// Solo almacenar mensajes 2 minutos después de cada pregunta
const CHANNEL_WATCH_WINDOW = 120 * 1000;

// En ask_feedback
this.watchChannelUntil = Date.now() + CHANNEL_WATCH_WINDOW;

// El LLM decide con un prompt simple
const isResponse = await this.checkIfResponse(
  originalQuestion,
  channelMessage,
  secondsElapsed
);
```

¿Te parece más práctico este enfoque?