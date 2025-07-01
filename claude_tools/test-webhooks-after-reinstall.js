import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function testWebhooks() {
  try {
    // Send test message
    const result = await client.chat.postMessage({
      channel: 'C093FU0CXC5', // claude-feedback
      text: '🔧 Test webhook después de reinstalar app - ' + new Date().toISOString()
    });
    
    console.log('✅ Mensaje enviado:', result.ts);
    console.log('Esperando 3 segundos...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check webhook health
    const health = await fetch('https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/health');
    const healthData = await health.json();
    
    console.log('\n📊 Estado del webhook:');
    console.log('- Mensajes del canal:', healthData.activeChannelMessages);
    console.log('- Respuestas activas:', healthData.activeResponses);
    
    // Check for channel messages
    const messages = await fetch(`https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/channel-messages/C093FU0CXC5`);
    const messagesData = await messages.json();
    
    console.log('\n📨 Mensajes en el canal:');
    console.log('- Total:', messagesData.count);
    if (messagesData.messages.length > 0) {
      console.log('- Último mensaje:', messagesData.messages[messagesData.messages.length - 1]);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWebhooks();