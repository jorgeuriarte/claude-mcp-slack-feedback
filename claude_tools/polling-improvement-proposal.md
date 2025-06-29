# Propuesta de Mejora del Sistema de Polling

## Sistema Actual
- Webhook: Respuestas instantáneas
- Polling: Solo manual, sin automatización

## Propuesta de Sistema Híbrido

### 1. Polling Automático con Backoff
```javascript
class PollingManager {
  private intervals = {
    initial: 2000,      // 2 segundos inicial
    normal: 5000,       // 5 segundos normal
    idle: 30000,        // 30 segundos cuando no hay actividad
    max: 60000          // 1 minuto máximo
  };
  
  private lastActivity: number;
  private currentInterval: number;
  
  startPolling() {
    // Ajustar intervalo basado en actividad
    if (Date.now() - this.lastActivity < 60000) {
      // Actividad reciente: polling frecuente
      this.currentInterval = this.intervals.normal;
    } else {
      // Sin actividad: reducir frecuencia
      this.currentInterval = Math.min(
        this.currentInterval * 1.5, 
        this.intervals.max
      );
    }
  }
}
```

### 2. Timeout Inteligente para Webhooks
```javascript
// En ask_feedback
if (session.mode === 'webhook') {
  // Esperar respuesta webhook con timeout
  const response = await Promise.race([
    waitForWebhookResponse(30000), // 30s timeout
    pollWithDelay(5000)             // Poll backup después de 5s
  ]);
}
```

### 3. Estrategia de Recuperación
- Si webhook no responde en 5s → iniciar polling
- Si webhook falla 3 veces → cambiar a modo polling
- Verificar salud del webhook cada 5 minutos

### 4. Configuración por Usuario
```json
{
  "polling": {
    "autoStart": true,
    "initialDelay": 2000,
    "maxInterval": 60000,
    "webhookTimeout": 30000,
    "hybridMode": true
  }
}
```

## Beneficios
1. **Mejor UX**: Respuestas más rápidas sin intervención manual
2. **Resilencia**: Fallback automático si webhook falla
3. **Eficiencia**: Ajuste dinámico basado en actividad
4. **Flexibilidad**: Configurable por usuario/sesión