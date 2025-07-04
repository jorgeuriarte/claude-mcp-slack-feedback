import { WebClient } from '@slack/web-api';
import { v4 as uuidv4 } from 'uuid';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const WEBHOOK_URL = 'https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app';

// Simulate the MCP tools
class MCPSimulator {
  constructor() {
    this.questionMetadata = new Map();
    this.channelId = null;
    this.sessionId = 'europa-vision-' + Date.now();
  }

  async createProjectChannel() {
    try {
      const result = await client.conversations.create({
        name: 'europa-alien-vision',
        is_private: false
      });
      this.channelId = result.channel.id;
      console.log('✅ Canal creado:', result.channel.name, '(' + this.channelId + ')');
      
      // Invite user
      await client.conversations.invite({
        channel: this.channelId,
        users: 'U026D8F8J' // juriarte
      });
      console.log('✅ Usuario invitado al canal');
      
      return this.channelId;
    } catch (error) {
      if (error.data?.error === 'name_taken') {
        // Channel already exists, find it
        const channels = await client.conversations.list();
        const channel = channels.channels.find(c => c.name === 'europa-alien-vision');
        if (channel) {
          this.channelId = channel.id;
          console.log('✅ Usando canal existente:', channel.name, '(' + this.channelId + ')');
          return this.channelId;
        }
      }
      throw error;
    }
  }

  async sendQuestion({ question, context, priority = 'normal', responseType = 'any' }) {
    const questionId = uuidv4();
    
    // Format message with visual indicators
    const priorityEmoji = {
      low: '🟢',
      normal: '🔵',
      high: '🟠',
      urgent: '🔴'
    }[priority] || '🔵';
    
    const responseTypeEmoji = {
      quick: '⚡',
      detailed: '📋',
      any: '💬'
    }[responseType] || '💬';
    
    const formattedMessage = `[Session: ${this.sessionId}]
${priorityEmoji} ${responseTypeEmoji} ${question}${context ? `\n\n📌 Context: ${context}` : ''}`;
    
    const result = await client.chat.postMessage({
      channel: this.channelId,
      text: formattedMessage
    });
    
    // Store metadata
    this.questionMetadata.set(questionId, {
      threadTs: result.ts,
      sessionId: this.sessionId,
      channelId: this.channelId,
      question,
      priority,
      responseType,
      sentAt: Date.now()
    });
    
    console.log(`\n📤 Pregunta enviada (${priority}):`, question.substring(0, 50) + '...');
    console.log('   Thread:', result.ts);
    console.log('   ID:', questionId);
    
    return { question_id: questionId, thread_ts: result.ts, channel_id: this.channelId };
  }

  async checkResponses(questionId, includeChannel = true) {
    const metadata = this.questionMetadata.get(questionId);
    if (!metadata) {
      console.log('❌ No se encontró metadata para:', questionId);
      return { thread_responses: [], channel_messages: [] };
    }
    
    console.log(`\n🔍 Verificando respuestas para pregunta ${questionId}...`);
    
    // Check thread responses
    const threadResponses = [];
    try {
      const replies = await client.conversations.replies({
        channel: metadata.channelId,
        ts: metadata.threadTs
      });
      
      for (const message of replies.messages) {
        if (message.ts !== metadata.threadTs && !message.bot_id) {
          threadResponses.push({
            user: message.user,
            text: message.text,
            ts: message.ts,
            is_thread_response: true
          });
        }
      }
    } catch (error) {
      console.error('Error checking thread:', error.message);
    }
    
    // Check channel messages if requested
    const channelMessages = [];
    if (includeChannel) {
      try {
        const response = await fetch(`${WEBHOOK_URL}/channel-messages/${metadata.channelId}`);
        const data = await response.json();
        
        // Filter messages after question was sent
        channelMessages.push(...data.messages.filter(msg => {
          const msgTime = parseFloat(msg.ts) * 1000;
          return msgTime > metadata.sentAt;
        }));
      } catch (error) {
        console.error('Error checking channel:', error.message);
      }
    }
    
    console.log(`   ✉️  Respuestas en thread: ${threadResponses.length}`);
    console.log(`   📨 Mensajes en canal: ${channelMessages.length}`);
    
    return {
      thread_responses: threadResponses,
      channel_messages: channelMessages,
      question_metadata: metadata
    };
  }

  async addReaction(channel, timestamp, reaction) {
    try {
      await client.reactions.add({
        channel,
        timestamp,
        name: reaction
      });
      console.log(`   ✅ Reacción '${reaction}' agregada`);
      return { success: true };
    } catch (error) {
      console.error('Error adding reaction:', error.message);
      return { success: false, error: error.message };
    }
  }

  async updateProgress(questionId, update) {
    const metadata = this.questionMetadata.get(questionId);
    if (!metadata) return;
    
    const message = `🔄 *Actualización de progreso:*\n${update}`;
    
    await client.chat.postMessage({
      channel: metadata.channelId,
      thread_ts: metadata.threadTs,
      text: message
    });
    
    console.log(`\n📊 Progreso actualizado:`, update);
  }
}

// Start the Europa Vision Project simulation
async function runEuropaProject() {
  console.log('🚀 Iniciando simulación del proyecto Europa Vision...\n');
  
  const mcp = new MCPSimulator();
  
  try {
    // 1. Create project channel
    await mcp.createProjectChannel();
    
    // 2. Send initial project kickoff question (HIGH priority)
    const q1 = await mcp.sendQuestion({
      question: `🛸 **Proyecto Europa Vision - Reconocimiento de Alienígenas**
      
Hola <@U026D8F8J>! Estoy iniciando el proyecto de reconocimiento visual de formas de vida en Europa.

**Objetivos del proyecto:**
• Desarrollar sistema de visión por computadora para satélites
• Detectar posibles señales de vida alienígena
• Procesar imágenes en tiempo real desde órbita

¿Podemos proceder con este proyecto? Por favor confirma tu interés y disponibilidad.`,
      context: 'Inicio de proyecto - Requiere confirmación',
      priority: 'high',
      responseType: 'quick'
    });
    
    console.log('\n⏳ Esperando 15 segundos para respuesta...');
    console.log('💡 Por favor responde en el canal #europa-alien-vision o en el thread');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Check for responses
    let responses = await mcp.checkResponses(q1.question_id);
    
    if (responses.thread_responses.length > 0 || responses.channel_messages.length > 0) {
      console.log('\n✅ Respuesta detectada!');
      
      // Add reaction to confirm receipt
      if (responses.thread_responses.length > 0) {
        await mcp.addReaction(q1.channel_id, responses.thread_responses[0].ts, 'eyes');
      }
      
      // 3. Technical requirements question (NORMAL priority)
      await mcp.updateProgress(q1.question_id, 'Proyecto confirmado. Procediendo con análisis técnico...');
      
      const q2 = await mcp.sendQuestion({
        question: `📋 **Requisitos Técnicos del Sistema**

Para el sistema de reconocimiento necesito definir:

1. **Resolución de imágenes**: ¿Qué resolución manejarán los satélites?
2. **Frecuencia de captura**: ¿Cada cuánto tiempo se tomarán imágenes?
3. **Almacenamiento**: ¿Procesamiento a bordo o envío a Tierra?

¿Tienes preferencias específicas o debo proponer una arquitectura?`,
        priority: 'normal',
        responseType: 'detailed'
      });
      
      console.log('\n⏳ Esperando 20 segundos para respuesta técnica...');
      await new Promise(resolve => setTimeout(resolve, 20000));
      
      responses = await mcp.checkResponses(q2.question_id);
      
      // 4. ML Model selection (HIGH priority)
      const q3 = await mcp.sendQuestion({
        question: `🤖 **Selección de Modelo ML - DECISIÓN IMPORTANTE**

He identificado 3 opciones para el modelo de detección:

A) **YOLOv8 modificado** - Rápido, eficiente en recursos
B) **Vision Transformer** - Mayor precisión, más recursos
C) **Modelo híbrido CNN+Transformer** - Balance

⚠️ Esta decisión impactará todo el desarrollo. ¿Cuál prefieres?`,
        context: 'Decisión arquitectónica crítica',
        priority: 'high',
        responseType: 'quick'
      });
      
      console.log('\n⏳ Esperando 15 segundos para decisión de modelo...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // 5. Progress update
      await mcp.updateProgress(q3.question_id, 'Iniciando implementación del modelo seleccionado...');
      
      // 6. Dataset question (LOW priority)
      const q4 = await mcp.sendQuestion({
        question: `📊 ¿Tienes datasets de entrenamiento de Europa o usamos simulaciones?`,
        priority: 'low',
        responseType: 'quick'
      });
      
      console.log('\n⏳ Esperando 10 segundos...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // 7. Critical issue (URGENT)
      const q5 = await mcp.sendQuestion({
        question: `🚨 **PROBLEMA CRÍTICO DETECTADO**

El modelo está detectando falsos positivos en el 73% de las imágenes de prueba.
Las formaciones de hielo están siendo clasificadas como "estructuras biológicas".

Opciones:
1. Reentrenar con más datos de hielo
2. Ajustar threshold de detección
3. Cambiar arquitectura del modelo

**Necesito una decisión URGENTE para continuar.**`,
        priority: 'urgent',
        responseType: 'quick'
      });
      
      console.log('\n⏳ Esperando 15 segundos para respuesta urgente...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      responses = await mcp.checkResponses(q5.question_id);
      if (responses.thread_responses.length > 0 || responses.channel_messages.length > 0) {
        // React with checkmark to urgent response
        const targetMsg = responses.thread_responses[0] || responses.channel_messages[0];
        if (targetMsg) {
          await mcp.addReaction(q5.channel_id, targetMsg.ts, 'white_check_mark');
        }
      }
      
      // 8. Performance optimization
      await mcp.updateProgress(q5.question_id, 'Aplicando solución al problema de falsos positivos...');
      
      const q6 = await mcp.sendQuestion({
        question: `⚡ El modelo ahora funciona mejor pero es lento (2.3s por imagen).

¿Optimizamos para velocidad o mantenemos la precisión actual?`,
        priority: 'normal',
        responseType: 'any'
      });
      
      console.log('\n⏳ Esperando 12 segundos...');
      await new Promise(resolve => setTimeout(resolve, 12000));
      
      // 9. Feature request
      const q7 = await mcp.sendQuestion({
        question: `✨ Propuesta de nueva característica:

Podría agregar detección de patrones de movimiento analizando secuencias de imágenes.
Esto podría diferenciar entre estructuras estáticas y posibles formas de vida.

¿Lo incluimos en esta versión o lo dejamos para v2?`,
        context: 'Feature opcional pero potencialmente valiosa',
        priority: 'normal',
        responseType: 'detailed'
      });
      
      console.log('\n⏳ Esperando 15 segundos...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // 10. Final deployment question
      const q8 = await mcp.sendQuestion({
        question: `🚀 **Sistema Listo para Despliegue**

Europa Vision v1.0 está completo:
✅ Precisión: 94.2%
✅ Velocidad: 0.8s/imagen (después de optimización)
✅ Detección de falsos positivos: <5%
✅ Integración con telemetría del satélite

¿Procedemos con el despliegue a los satélites de prueba?`,
        priority: 'high',
        responseType: 'quick'
      });
      
      console.log('\n⏳ Esperando confirmación final (15 segundos)...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      responses = await mcp.checkResponses(q8.question_id);
      if (responses.thread_responses.length > 0 || responses.channel_messages.length > 0) {
        await mcp.addReaction(q8.channel_id, q8.thread_ts, 'rocket');
        await mcp.updateProgress(q8.question_id, '🎉 Proyecto Europa Vision completado y desplegado exitosamente!');
      }
      
      // Final summary
      console.log('\n\n📊 RESUMEN DE LA SIMULACIÓN:');
      console.log('================================');
      console.log('Total de interacciones: 8 preguntas principales');
      console.log('Prioridades usadas: LOW (1), NORMAL (3), HIGH (3), URGENT (1)');
      console.log('Tipos de respuesta: QUICK (5), DETAILED (2), ANY (1)');
      console.log('Reacciones agregadas: eyes, white_check_mark, rocket');
      console.log('Actualizaciones de progreso: 4');
      console.log('\n✅ Simulación completada exitosamente!');
      
    } else {
      console.log('❌ No se recibió respuesta inicial. Abortando simulación.');
    }
    
  } catch (error) {
    console.error('❌ Error en la simulación:', error);
  }
}

// Run the simulation
runEuropaProject();