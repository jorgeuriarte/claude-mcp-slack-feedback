# Claude MCP Slack Feedback - Especificación Completa

## Objetivo del Proyecto

Crear un servidor MCP (Model Context Protocol) que permita a Claude Code solicitar feedback humano a través de Slack de manera completamente automática, soportando múltiples usuarios y múltiples sesiones simultáneas.

## Experiencia de Usuario Objetivo

### Primera Vez (Auto-configuración)
```bash
claude-code --mcp slack-feedback "Build complete authentication system"

# Output automático:
🔧 Primera configuración de Slack...
🔑 Slack Bot Token (xoxb-...): [usuario introduce token]
✅ Token válido! Workspace: GailenTech
💾 Configuración guardada en ~/.claude-mcp-slack.json
🌐 Iniciando túnel automático en puerto 3123...
✅ Túnel activo: https://abc123.trycloudflare.com
📝 Configura webhook en Slack: https://abc123.trycloudflare.com/slack/events
📢 Canal creado: #claude-jorgeuriarte-auth-system
🚀 Claude Code iniciado con feedback via Slack
```

### Uso Diario (Cero configuración)
```bash
# Terminal 1
claude-code --mcp slack-feedback "Add payment processing with Stripe"
# → Canal: #claude-jorgeuriarte-payments

# Terminal 2  
claude-code --mcp slack-feedback "Create admin dashboard"
# → Canal: #claude-jorgeuriarte-admin-dashboard

# Terminal 3
claude-code --mcp slack-feedback "Fix database performance"
# → Canal: #claude-jorgeuriarte-database-perf
```

### Interacción en Slack
```
🤖 Feedback necesario (jorgeuriarte)

Proyecto: auth-system
Pregunta: ¿Prefieres JWT tokens o session-based authentication?

Contexto: Implementando autenticación para la API REST. Necesito decidir entre...

*Responde en este hilo*
*ID: q_jorgeuriarte_1719842*
```

Usuario responde en hilo → Claude Code recibe respuesta automáticamente y continúa.

## Arquitectura del Sistema

### Componentes Principales

1. **MCP Server Auto-Configurado** (`src/index.ts`)
   - Servidor MCP que maneja herramientas de Slack
   - Auto-configuración en primera ejecución
   - Gestión de múltiples sesiones por usuario
   - Sistema híbrido webhook/polling

2. **Auto-Installer Script** (`install.sh`)
   - Instalación automática de dependencias
   - Configuración de Claude Code
   - Creación de scripts de conveniencia

3. **Claude Code Integration**
   - Configuración automática del MCP server
   - Herramientas expuestas a Claude Code

### Arquitectura Multi-Usuario/Multi-Sesión

```
Developer 1 (jorgeuriarte)
├── MCP Server:3123 ─── Tunnel ─────────┐
├── Session: auth-system               │
├── Session: payments                  │    ┌─ Slack Workspace ─┐
└── Session: admin-ui                  ├────┤                   │
                                       │    │ #claude-jorge-*   │
Developer 2 (antonio)                  │    │ #claude-antonio-* │
├── MCP Server:3456 ─── Tunnel ─────────┤    │ #claude-maria-*   │
└── Session: mobile-app                │    │                   │
                                       │    │ Shared Bot Token  │
Developer 3 (maria)                    │    │ Event Distribution│
├── MCP Server:3789 ─── Polling ───────┘    │ Rate Limiting     │
└── Session: devops                         └───────────────────┘
```

## Especificaciones Técnicas

### Tecnologías Requeridas
- **Node.js 18+** con TypeScript
- **@modelcontextprotocol/sdk** para MCP
- **@slack/web-api** para integración con Slack
- **express** para webhook server
- **cloudflared** para túneles automáticos

### Estructura del Proyecto
```
claude-mcp-slack-feedback/
├── src/
│   ├── index.ts                    # MCP Server principal
│   ├── types.ts                    # Interfaces TypeScript
│   ├── config-manager.ts           # Gestión de configuración
│   ├── session-manager.ts          # Gestión multi-sesión
│   ├── tunnel-manager.ts           # Gestión de túneles
│   └── slack-client.ts             # Cliente Slack con rate limiting
├── scripts/
│   ├── install.sh                  # Instalador automático
│   └── setup-team.sh               # Setup para equipos
├── package.json
├── tsconfig.json
├── README.md
└── .gitignore
```

### Interfaces TypeScript Principales

```typescript
interface SessionConfig {
  sessionId: string;
  userId: string;
  projectName: string;
  channelId: string;
  channelName: string;
  webhookMode: boolean;
  tunnelUrl?: string;
  pendingQuestions: Map<string, PendingQuestion>;
  createdAt: number;
}

interface PendingQuestion {
  id: string;
  sessionId: string;
  userId: string;
  question: string;
  context?: string;
  timestamp: number;
  resolved: boolean;
  response?: string;
  threadTs?: string;
  respondedBy?: string;
  responseTimestamp?: number;
  lastCheck?: number;
}

interface SlackConfig {
  botToken: string;
  workspaceId?: string;
  userId: string;
  userPrefix: string;
  tunnelPort: number;
  webhookMode: boolean;
  setupComplete: boolean;
}
```

## Herramientas MCP Expuestas

### 1. `setup_slack_config`
```typescript
inputSchema: {
  bot_token: string;      // Token del bot (xoxb-...)
  workspace_id?: string;  // ID del workspace (opcional)
}
```
- Configura credenciales de Slack interactivamente
- Valida token con Slack API
- Guarda configuración en `~/.claude-mcp-slack.json`

### 2. `ask_feedback`
```typescript
inputSchema: {
  question: string;       // Pregunta para el usuario
  context?: string;       // Contexto opcional
  urgent?: boolean;       // Marcar como urgente (@channel)
  timeout_minutes?: number; // Timeout (default: 30)
}
```
- Envía pregunta al canal de la sesión actual
- Crea hilo de conversación en Slack
- Gestiona timeout automático

### 3. `update_progress`
```typescript
inputSchema: {
  status: string;         // Descripción del progreso
  percentage?: number;    // Porcentaje 0-100
  milestone?: string;     // Hito alcanzado
  details?: string;       // Detalles adicionales
}
```
- Envía actualizaciones de progreso al canal
- Muestra barra de progreso visual
- Notifica hitos importantes

### 4. `get_responses`
```typescript
inputSchema: {
  include_all_sessions?: boolean; // Incluir todas las sesiones del usuario
}
```
- Obtiene respuestas pendientes
- Modo webhook: respuestas instantáneas
- Modo polling: consulta Slack API
- Limpia preguntas resueltas automáticamente

### 5. `list_sessions`
```typescript
inputSchema: {}
```
- Lista todas las sesiones activas del usuario
- Muestra estado de cada sesión
- Información de preguntas pendientes

## Funcionalidades Avanzadas

### Sistema Híbrido Webhook/Polling

**Modo Webhook (Preferido)**
- Túnel automático con cloudflared
- Respuestas en tiempo real
- Puerto único por usuario (hash del nombre)
- Auto-recovery si túnel falla

**Modo Polling (Fallback)**
- Consulta Slack API cada 5 segundos
- Funciona sin túnel
- Rate limiting inteligente
- Menor latencia pero más confiable

### Auto-Configuración por Usuario

**Detección Automática**
- Usuario: `process.env.USER` o `os.userInfo().username`
- Puerto: Hash del usuario (3000-3999)
- Canales: `claude-{usuario}-{proyecto}`

**Gestión de Estado**
- Estado por sesión independiente
- Persistencia entre reinicios
- Limpieza automática de sesiones completadas

### Rate Limiting y Resilencia

**Rate Limiting**
- Límites por usuario
- Backoff exponencial
- Cola de requests

**Error Handling**
- Auto-retry con backoff
- Fallback graceful
- Logging detallado

## Configuración de Slack Requerida

### Crear Slack App
1. Ir a https://api.slack.com/apps
2. "Create New App" → "From scratch"
3. Nombre: "Claude Code Feedback"
4. Workspace: GailenTech

### Permisos del Bot
**OAuth & Permissions** → Bot Token Scopes:
- `chat:write` - Enviar mensajes
- `chat:write.public` - Enviar a canales públicos
- `channels:read` - Leer lista de canales
- `channels:manage` - Crear canales
- `conversations.history` - Leer mensajes (para polling)
- `reactions:write` - Añadir reacciones

### Event Subscriptions
**Request URL**: `{tunnel-url}/slack/events`

**Subscribe to bot events**:
- `message.channels` - Mensajes en canales
- `message.groups` - Mensajes en grupos privados

### Instalación
- "Install to Workspace"
- Copiar "Bot User OAuth Token" (xoxb-...)

## Instalación y Configuración

### Script de Instalación Automática

El `install.sh` debe:

1. **Verificar dependencias**
   - Node.js 18+
   - npm/yarn/pnpm
   - cloudflared

2. **Instalar dependencias faltantes**
   - Node.js (brew/apt)
   - cloudflared (brew/descarga directa)

3. **Crear estructura del proyecto**
   - Directorio en `~/.claude-mcp-slack`
   - Compilar TypeScript
   - Instalar dependencies

4. **Configurar Claude Code automáticamente**
   - Modificar `~/.config/claude-code/config.json`
   - Añadir MCP server configuration

5. **Crear scripts de conveniencia**
   - `claude-slack` wrapper script
   - Añadir al PATH

### Configuración de Claude Code
```json
{
  "mcpServers": {
    "slack-feedback": {
      "command": "node",
      "args": ["~/.claude-mcp-slack/build/index.js"],
      "env": {}
    }
  }
}
```

## Implementación Detallada

### Auto-Setup Flow
1. **Primera ejecución**: Detecta ausencia de config
2. **Prompt interactivo**: Solicita Slack bot token
3. **Validación**: Testa token con `auth.test`
4. **Auto-configuración**: Detecta usuario, asigna puerto
5. **Túnel setup**: Inicia cloudflared automáticamente
6. **Sesión setup**: Crea canal y anuncia inicio

### Session Management
- **Detección de proyecto**: Nombre del directorio actual
- **Canal naming**: `claude-{usuario}-{proyecto-sanitizado}`
- **Estado persistente**: Map de sesiones en memoria
- **Cleanup**: Timeout de sesiones inactivas

### Webhook vs Polling Logic
```typescript
async setupMode() {
  try {
    await this.startTunnel();
    this.mode = 'webhook';
    this.startWebhookServer();
  } catch {
    this.mode = 'polling';
    this.startPollingMode();
  }
}
```

### Multi-User Port Assignment
```typescript
getAssignedPort(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
  }
  return 3000 + Math.abs(hash) % 1000; // 3000-3999
}
```

## Casos de Uso y Testing

### Casos de Uso Principales

1. **Desarrollador individual, múltiples proyectos**
   - 3 terminales con claude-code
   - 3 canales diferentes
   - Estado independiente

2. **Equipo de desarrollo**
   - 5 desarrolladores
   - 15 proyectos total
   - Sin conflictos de puertos/canales

3. **Red inestable**
   - Túnel falla → fallback a polling
   - Auto-recovery cuando red mejora
   - Usuario no nota diferencia

### Testing Strategy

**Unit Tests**
- Session management
- Port assignment
- Channel naming
- Rate limiting

**Integration Tests**
- Slack API integration
- Webhook handling
- Polling fallback
- Multi-session management

**E2E Tests**
- Full installation flow
- First-time setup
- Multiple concurrent sessions
- Network failure scenarios

## Git Repository Setup

### Repository Structure
```
GailenTech/claude-mcp-slack-feedback
├── README.md                       # Documentación completa
├── INSTALL.md                      # Guía de instalación
├── src/                           # Código fuente TypeScript
├── scripts/                       # Scripts de instalación
├── tests/                         # Tests
├── docs/                          # Documentación adicional
├── examples/                      # Ejemplos de uso
└── package.json
```

### README.md Structure
1. **Quick Start** - Comando de instalación único
2. **Features** - Lista de características principales
3. **Installation** - Guía paso a paso
4. **Configuration** - Configuración de Slack
5. **Usage** - Ejemplos de uso
6. **Architecture** - Diagrama y explicación
7. **Troubleshooting** - Problemas comunes
8. **Contributing** - Guía de contribución

### Release Strategy
- **v1.0.0**: Funcionalidad básica single-user
- **v1.1.0**: Multi-session support
- **v1.2.0**: Multi-user support  
- **v1.3.0**: Hybrid webhook/polling
- **v2.0.0**: Advanced features (persistence, analytics)

## Checklist de Desarrollo

### Fase 1: Core MCP Server
- [ ] Estructura básica del MCP server
- [ ] Herramientas básicas (ask_feedback, get_responses)
- [ ] Integración con Slack API
- [ ] Configuración inicial

### Fase 2: Auto-Setup
- [ ] Auto-detección de usuario
- [ ] Configuración interactiva
- [ ] Validación de Slack token
- [ ] Auto-configuración de Claude Code

### Fase 3: Multi-Session
- [ ] Gestión de múltiples sesiones
- [ ] Session isolation
- [ ] Channel auto-creation
- [ ] State management

### Fase 4: Hybrid Mode
- [ ] Tunnel management con cloudflared
- [ ] Webhook server setup
- [ ] Polling fallback
- [ ] Auto-recovery logic

### Fase 5: Multi-User
- [ ] Port assignment per user
- [ ] User-specific channel naming
- [ ] Independent state per user
- [ ] Rate limiting per user

### Fase 6: Polish & Deploy
- [ ] Error handling comprehensive
- [ ] Logging and debugging
- [ ] Documentation completa
- [ ] Installation script
- [ ] Testing suite

## Comandos para Claude Code

```bash
# Crear repository
gh repo create GailenTech/claude-mcp-slack-feedback --public --description "MCP Server for Slack-based feedback in Claude Code"

# Setup inicial
cd claude-mcp-slack-feedback
npm init -y
npm install @modelcontextprotocol/sdk @slack/web-api express
npm install -D typescript @types/node tsx
npx tsc --init

# Desarrollo
npm run build
npm run dev
npm test

# Release
npm run build
git tag v1.0.0
git push --tags
```

---

**Nota para Claude Code**: Esta especificación proporciona todo lo necesario para implementar el sistema completo. Prioriza la auto-configuración y experiencia de usuario fluida. El código debe ser robusto con manejo de errores extensivo y logging detallado para debugging.