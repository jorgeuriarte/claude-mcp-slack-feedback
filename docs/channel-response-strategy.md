# Estrategia para Respuestas en Canal

## Problema
En un canal con múltiples desarrolladores y potencialmente varios bots de Claude Code, necesitamos:
1. Capturar respuestas fuera del thread cuando sea natural
2. Evitar malinterpretaciones 
3. Mantener la practicidad

## Solución Propuesta: Sistema de Contexto Inteligente

### 1. Ventana de Tiempo Contextual
```javascript
const RESPONSE_WINDOW = {
  IMMEDIATE: 30,      // 30 segundos - respuesta muy probable
  PROBABLE: 120,      // 2 minutos - respuesta probable
  POSSIBLE: 300,      // 5 minutos - respuesta posible
  MAX: 600           // 10 minutos - límite máximo
};
```

### 2. Señales de Contexto
Una respuesta en el canal se considera válida si cumple alguna de estas condiciones:

#### A. Mención Directa
- `@claude-bot sí funciona`
- Menciona el session ID: `para final-123: sí funciona`
- Referencia la pregunta: `respecto a lo del webhook, funciona`

#### B. Respuesta Directa Temporal
- Dentro de 30 segundos Y es del mismo usuario que suele responder
- Empieza con palabras clave: "sí", "no", "funciona", etc.
- Es una de las opciones sugeridas

#### C. Contexto Conversacional
- El usuario ha estado activo en el thread
- No hay otras conversaciones activas en el canal
- El mensaje tiene relación semántica con la pregunta

### 3. Implementación Práctica

```javascript
// En el webhook handler
async function handleChannelMessage(event) {
  // No es una respuesta en thread
  if (!event.thread_ts) {
    const recentQuestions = await getRecentQuestions(event.channel);
    
    for (const question of recentQuestions) {
      const score = calculateRelevanceScore(event, question);
      
      if (score > THRESHOLD) {
        // Confirmar con el usuario
        await sendConfirmation(event, question);
        break;
      }
    }
  }
}

function calculateRelevanceScore(message, question) {
  let score = 0;
  
  // Tiempo transcurrido
  const elapsed = message.ts - question.ts;
  if (elapsed < RESPONSE_WINDOW.IMMEDIATE) score += 50;
  else if (elapsed < RESPONSE_WINDOW.PROBABLE) score += 30;
  else if (elapsed < RESPONSE_WINDOW.POSSIBLE) score += 10;
  
  // Mención directa
  if (message.text.includes(question.sessionId)) score += 100;
  if (message.text.includes(`<@${question.botId}>`)) score += 100;
  
  // Usuario frecuente
  if (isFrequentResponder(message.user, question.channel)) score += 20;
  
  // Análisis semántico simple
  if (matchesOptions(message.text, question.options)) score += 40;
  if (hasKeywords(message.text, question.keywords)) score += 30;
  
  return score;
}
```

### 4. Confirmación Natural

Cuando detectamos una posible respuesta, confirmamos sutilmente:

```javascript
async function sendConfirmation(message, question) {
  // Reacción emoji para confirmar
  await slack.reactions.add({
    channel: message.channel,
    timestamp: message.ts,
    name: 'white_check_mark'
  });
  
  // Mensaje en thread original
  await slack.chat.postMessage({
    channel: question.channel,
    thread_ts: question.ts,
    text: `✅ Recibí la respuesta de <@${message.user}>: "${message.text}"`
  });
}
```

### 5. Gestión Multi-Bot

Para evitar conflictos entre múltiples bots:

```javascript
// Cada bot tiene un prefijo único
const BOT_PREFIX = {
  'jorge-main': '🟦',
  'jorge-feature': '🟩',
  'maria-dev': '🟨'
};

// Las preguntas incluyen identificador visual
const questionText = `${BOT_PREFIX[sessionId]} Pregunta de Claude [${sessionLabel}]...`;

// Respuestas pueden usar el prefijo
if (message.text.includes('🟦') || message.text.includes('azul')) {
  // Probablemente para jorge-main
}
```

### 6. Mejores Prácticas

1. **Preguntas Claras**:
   ```
   🟦 [Feature: Auth] @jorge
   ¿Debo usar JWT o sessions?
   
   Responde con:
   • "JWT" para tokens
   • "sessions" para server-side
   • En thread para explicación detallada
   ```

2. **Timeouts Inteligentes**:
   - Preguntas simples (sí/no): 2 minutos
   - Preguntas complejas: solo en thread
   - Confirmaciones: 30 segundos

3. **Feedback Visual**:
   - ✅ Respuesta recibida
   - ⏳ Esperando respuesta
   - ❓ No estoy seguro si esto era para mí

### 7. Configuración por Usuario

```javascript
// Preferencias del usuario
{
  "allowChannelResponses": true,
  "channelResponseWindow": 120,
  "requireMention": false,
  "autoConfirm": true,
  "smartMatching": true
}
```

## Ejemplo de Flujo

1. **Claude pregunta**:
   ```
   🟦 [API Design] @jorge
   ¿Uso REST o GraphQL para el nuevo endpoint?
   
   Responde "REST" o "GraphQL" (o en thread para detalles)
   ```

2. **Jorge responde en canal** (20 segundos después):
   ```
   REST
   ```

3. **Claude confirma**:
   - ✅ reacción al mensaje
   - En el thread: "✅ Recibido: REST"
   - Continúa con la tarea

4. **Si hay duda**:
   ```
   ❓ @jorge, ¿era "REST" la respuesta a mi pregunta sobre el API? 
   Reacciona con 👍 para confirmar
   ```

## Ventajas

1. **Natural**: Permite respuestas rápidas sin cambiar de contexto
2. **Seguro**: Confirmación evita malentendidos
3. **Flexible**: Se adapta al estilo de cada equipo
4. **Escalable**: Funciona con múltiples bots y usuarios
5. **Transparente**: Todo queda documentado