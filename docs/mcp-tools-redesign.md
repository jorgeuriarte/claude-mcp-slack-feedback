# Rediseño de Tools MCP para Respuestas Inteligentes

## Filosofía del Cambio

En lugar de una única tool `ask_feedback` que bloquea, proponemos un sistema de tools granulares que permiten al LLM tomar decisiones inteligentes sobre las respuestas.

## Tools Propuestas

### 1. `send_question`
Envía una pregunta sin bloquear, retorna el thread ID inmediatamente.

```typescript
{
  name: 'send_question',
  description: `Send a question to Slack without waiting for response.
  
  Returns immediately with a question_id that can be used to check for responses later.
  The question will be posted to the configured channel with visual indicators.
  
  Use this when you want to continue working while waiting for a human response.`,
  
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The question to ask'
      },
      context: {
        type: 'string',
        description: 'Optional context to help the human understand'
      },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Suggested response options'
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'urgent'],
        description: 'Visual priority indicator (affects emoji and formatting)'
      },
      response_type: {
        type: 'string',
        enum: ['quick', 'detailed', 'any'],
        description: 'quick: expect short answer in channel, detailed: expect thread response'
      }
    },
    required: ['question']
  }
}
```

### 2. `check_responses`
Verifica si hay respuestas (thread o canal) y las analiza.

```typescript
{
  name: 'check_responses',
  description: `Check for responses to a previously sent question.
  
  This tool will:
  1. Check for responses in the thread
  2. Check for recent channel messages (last 2 minutes)
  3. Use your judgment to determine if any channel message is a response
  4. Return all potential responses with confidence levels
  
  You should analyze the responses and decide:
  - If a channel message seems like a response to your question
  - The confidence level (high/medium/low)
  - Whether to accept, ignore, or ask for clarification
  
  Channel messages include timing and context to help you judge.`,
  
  inputSchema: {
    type: 'object',
    properties: {
      question_id: {
        type: 'string',
        description: 'The ID returned by send_question'
      },
      include_channel: {
        type: 'boolean',
        default: true,
        description: 'Whether to check channel messages for potential responses'
      },
      channel_window: {
        type: 'number',
        default: 120,
        description: 'Seconds to look back for channel messages (max 300)'
      }
    },
    required: ['question_id']
  }
}
```

### 3. `confirm_response`
Confirma que aceptaste una respuesta con reacción y mensaje.

```typescript
{
  name: 'confirm_response',
  description: `Confirm that you've accepted a response.
  
  This will:
  1. Add a ✅ reaction to the message
  2. Post a confirmation in the original thread
  3. Wait 30 seconds for any corrections/cancellations
  
  Use this after you've decided to accept a response from check_responses.
  The 30-second window allows humans to correct misunderstandings.`,
  
  inputSchema: {
    type: 'object',
    properties: {
      question_id: {
        type: 'string',
        description: 'The original question ID'
      },
      message_ts: {
        type: 'string',
        description: 'Timestamp of the message you\'re accepting'
      },
      interpretation: {
        type: 'string',
        description: 'Your interpretation of the response (shown in confirmation)'
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Your confidence in this interpretation'
      }
    },
    required: ['question_id', 'message_ts', 'interpretation']
  }
}
```

### 4. `request_clarification`
Pide aclaración cuando no estás seguro.

```typescript
{
  name: 'request_clarification',
  description: `Request clarification when you're unsure about a response.
  
  Use this when:
  - Multiple contradicting responses
  - Ambiguous channel messages
  - Low confidence in your interpretation
  
  This will add a ❓ reaction and ask for clarification.`,
  
  inputSchema: {
    type: 'object',
    properties: {
      question_id: {
        type: 'string'
      },
      message_ts: {
        type: 'string',
        description: 'Optional: specific message that needs clarification'
      },
      clarification_request: {
        type: 'string',
        description: 'What specifically needs clarification'
      }
    },
    required: ['question_id', 'clarification_request']
  }
}
```

### 5. `mark_no_response`
Marca que no recibiste respuesta y decide qué hacer.

```typescript
{
  name: 'mark_no_response',
  description: `Mark that you haven't received a response and decide next action.
  
  Use this after reasonable waiting time. You can:
  - Continue without the answer
  - Ask again with different wording
  - Escalate to a different channel/person
  - Make an assumption and note it`,
  
  inputSchema: {
    type: 'object',
    properties: {
      question_id: {
        type: 'string'
      },
      action: {
        type: 'string',
        enum: ['continue', 'ask_again', 'escalate', 'assume'],
        description: 'What you plan to do'
      },
      reason: {
        type: 'string',
        description: 'Brief explanation of your decision'
      },
      assumption: {
        type: 'string',
        description: 'If action is "assume", what you\'re assuming'
      }
    },
    required: ['question_id', 'action', 'reason']
  }
}
```

### 6. `add_reaction`
Tool genérica para añadir reacciones a mensajes.

```typescript
{
  name: 'add_reaction',
  description: `Add an emoji reaction to any message.
  
  Common reactions:
  - white_check_mark (✅): Confirmed/accepted
  - eyes (👀): Seen/processing
  - thinking_face (🤔): Considering
  - question (❓): Need clarification
  - timer_clock (⏲️): Will check back later
  - thumbsup (👍): Acknowledged
  
  Use reactions for lightweight communication without adding noise.`,
  
  inputSchema: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID where the message is'
      },
      timestamp: {
        type: 'string',
        description: 'Message timestamp'
      },
      reaction: {
        type: 'string',
        description: 'Emoji name without colons (e.g., "thumbsup", not ":thumbsup:")'
      }
    },
    required: ['channel', 'timestamp', 'reaction']
  }
}
```

## Flujo de Trabajo Ejemplo

```typescript
// 1. Claude envía pregunta
const { question_id } = await send_question({
  question: "Should I use REST or GraphQL for this API?",
  options: ["REST", "GraphQL", "Other (explain in thread)"],
  priority: "normal",
  response_type: "quick"
});

// 2. Claude continúa trabajando en otras cosas...

// 3. Después de un tiempo, verifica respuestas
const responses = await check_responses({
  question_id,
  include_channel: true,
  channel_window: 120
});

// 4. Claude analiza las respuestas
// Respuestas ejemplo:
// - Thread: (ninguna)
// - Canal: "REST" (10s después)
// - Canal: "definitivamente REST para esto" (25s después)

// 5. Claude decide aceptar "REST"
await confirm_response({
  question_id,
  message_ts: responses.channel[0].ts,
  interpretation: "Use REST for the API",
  confidence: "high"
});

// 6. Espera 30 segundos por correcciones...

// 7. Continúa con REST
```

## Ventajas del Nuevo Sistema

1. **No Bloqueante**: Claude puede hacer otras cosas mientras espera
2. **Decisiones Inteligentes**: El LLM decide qué es una respuesta válida
3. **Transparente**: Reacciones y confirmaciones visibles
4. **Flexible**: Puede manejar respuestas en thread o canal
5. **Autocorrectivo**: Ventana de 30s para correcciones
6. **Granular**: Cada acción es una decisión explícita

## Configuración de Comportamiento

```typescript
// En la descripción del MCP server
{
  name: "claude-mcp-slack-feedback",
  description: `MCP server for human feedback via Slack.
  
  IMPORTANT: When asking questions:
  1. Use send_question for non-blocking questions
  2. Check responses periodically with check_responses
  3. Use YOUR judgment to determine if channel messages are responses
  4. Always confirm accepted responses with confirm_response
  5. Wait for the 30-second confirmation window
  6. If unsure, use request_clarification
  7. After reasonable time (~2-5 min), use mark_no_response
  
  Response Analysis Guidelines:
  - Messages within 30s of question are likely responses
  - Short messages matching your options are high confidence
  - Consider user patterns (some users always answer)
  - Ignore obvious unrelated conversations
  - When in doubt, ask for clarification`
}
```

## Implementación Por Fases

### Fase 1: Tools Básicas
- `send_question` (adaptar ask_feedback actual)
- `check_responses` (nuevo)
- `add_reaction` (nuevo)

### Fase 2: Inteligencia
- `confirm_response` con ventana de 30s
- `request_clarification`
- Análisis LLM de mensajes del canal

### Fase 3: Flujo Completo
- `mark_no_response`
- Métricas y patrones de usuario
- Configuración por sesión

¿Qué opinas de este diseño?