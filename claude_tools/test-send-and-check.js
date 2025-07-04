import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const WEBHOOK_URL = 'https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app';

async function testSendAndCheck() {
  try {
    console.log('📤 Enviando mensaje de prueba al canal...');
    
    // Send a test message as bot
    const botMsg = await client.chat.postMessage({
      channel: 'C093FU0CXC5',
      text: `🧪 Test mensaje del canal (no thread) - ${new Date().toISOString()}`
    });
    
    console.log('✅ Mensaje del bot enviado:', botMsg.ts);
    console.log('   Canal:', botMsg.channel);
    console.log('   Thread:', botMsg.thread_ts || 'NO ES UN THREAD');
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check logs for this specific message
    console.log('\n🔍 Verificando si el webhook recibió el evento...');
    
    const health = await fetch(`${WEBHOOK_URL}/health`);
    const healthData = await health.json();
    
    console.log('\n📊 Estado del webhook:');
    console.log('- Mensajes del canal:', healthData.activeChannelMessages);
    console.log('- Respuestas de thread:', healthData.activeResponses);
    
    // Now ask user to send a message
    console.log('\n👤 AHORA TÚ: Por favor envía un mensaje de usuario al canal #claude-feedback');
    console.log('   (NO como respuesta a un thread, directamente al canal)');
    console.log('   Esperando 10 segundos...\n');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check again
    const health2 = await fetch(`${WEBHOOK_URL}/health`);
    const healthData2 = await health2.json();
    
    console.log('📊 Después del mensaje de usuario:');
    console.log('- Mensajes del canal:', healthData2.activeChannelMessages);
    console.log('- Respuestas de thread:', healthData2.activeResponses);
    
    // Get channel messages
    const channelRes = await fetch(`${WEBHOOK_URL}/channel-messages/C093FU0CXC5`);
    const channelData = await channelRes.json();
    
    console.log('\n📨 Mensajes encontrados:', channelData.count);
    if (channelData.messages.length > 0) {
      channelData.messages.forEach(msg => {
        console.log(`- [${msg.ts}] ${msg.user}: ${msg.text}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSendAndCheck();