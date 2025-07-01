# Debug de Webhooks de Slack con Pipedream

## Opción 1: Pipedream (Recomendado)

Pipedream puede manejar automáticamente el challenge de Slack y mostrarte todos los eventos.

### Pasos:

1. Ve a https://pipedream.com y crea una cuenta gratuita (o usa Google/GitHub)

2. Crea un nuevo workflow:
   - Click en "New" → "New Workflow"
   - Selecciona "HTTP / Webhook Requests" como trigger
   - Te dará una URL única como: `https://eoXXXXXXXX.m.pipedream.net`

3. Añade código para manejar el challenge de Slack:
   - Click en el "+" después del trigger
   - Selecciona "Run Node.js code"
   - Pega este código:

```javascript
export default defineComponent({
  async run({ steps, $ }) {
    const body = steps.trigger.event.body;
    
    // Log del evento recibido
    console.log('Headers:', steps.trigger.event.headers);
    console.log('Body:', body);
    
    // Si es un challenge de verificación, responder con el challenge
    if (body && body.type === 'url_verification') {
      await $.respond({
        status: 200,
        body: body.challenge
      });
      return;
    }
    
    // Para otros eventos, responder OK
    await $.respond({
      status: 200,
      body: 'ok'
    });
  }
})
```

4. Deploy el workflow

5. Usa la URL de Pipedream en Slack Event Subscriptions

6. Todos los eventos aparecerán en el inspector de Pipedream

## Opción 2: Webhook.site (Más Simple pero Manual)

Si solo quieres ver qué está enviando Slack sin que funcione el challenge:

1. Ve a https://webhook.site
2. Copia tu URL única
3. Úsala en Slack (fallará la verificación pero verás el payload)
4. Mira qué envía Slack cuando intentas verificar

## Qué Buscar en los Logs

1. **Headers importantes**:
   - `Content-Type`: ¿Es `application/json` o `application/x-www-form-urlencoded`?
   - `X-Slack-Signature`: Para verificación
   - `X-Slack-Request-Timestamp`: Timestamp de la request

2. **En el Body**:
   - Para verificación: `{"type": "url_verification", "challenge": "..."}`
   - Para mensajes: Estructura del evento con `thread_ts`, `channel`, etc.

3. **Problemas comunes**:
   - Body viene como string en lugar de objeto
   - Content-Type incorrecto
   - Eventos no suscritos correctamente
   - Permisos del bot insuficientes