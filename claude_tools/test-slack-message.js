#!/usr/bin/env node

import { WebClient } from '@slack/web-api';

const token = process.env.SLACK_BOT_TOKEN;
if (!token) {
  console.error('SLACK_BOT_TOKEN not set');
  process.exit(1);
}
const client = new WebClient(token);

async function sendTestMessage() {
  try {
    // Buscar canales de Claude
    const result = await client.conversations.list();
    const claudeChannels = result.channels.filter(ch => ch.name.startsWith('claude-'));
    
    if (claudeChannels.length === 0) {
      console.log('No se encontraron canales de Claude');
      return;
    }
    
    console.log('Canales encontrados:');
    claudeChannels.forEach(ch => console.log(`- #${ch.name} (${ch.id})`));
    
    // Enviar mensaje al primer canal
    const channel = claudeChannels[0];
    const testMessage = await client.chat.postMessage({
      channel: channel.id,
      text: `🧪 **Mensaje de prueba del sistema Cloud Polling**\n\nEste es un mensaje automático para probar el sistema.\nPor favor responde en este thread para verificar que los webhooks funcionan correctamente.\n\nTimestamp: ${new Date().toISOString()}`,
      mrkdwn: true
    });
    
    console.log(`\n✅ Mensaje enviado a #${channel.name}`);
    console.log(`Thread timestamp: ${testMessage.ts}`);
    console.log(`\nAhora responde en Slack en el thread de este mensaje.`);
    
    // Extraer sessionId del nombre del canal
    const match = channel.name.match(/claude-(.+)-(.+)/);
    if (match) {
      const [, user, sessionId] = match;
      console.log(`\nPara verificar las respuestas manualmente:`);
      console.log(`curl "https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/responses/${sessionId}/${testMessage.ts}"`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

sendTestMessage();