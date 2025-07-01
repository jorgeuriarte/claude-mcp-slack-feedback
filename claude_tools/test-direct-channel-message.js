import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function sendUserMessage() {
  console.log('⚠️  IMPORTANTE: Para que este test funcione correctamente:');
  console.log('1. Envía un mensaje DIRECTAMENTE al canal #claude-feedback');
  console.log('2. NO lo envíes como respuesta a un thread');
  console.log('3. El mensaje debe ser de un usuario (no un bot)\n');
  
  console.log('Esperando 15 segundos para que envíes el mensaje...\n');
  
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  // Check webhook
  const WEBHOOK_URL = 'https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app';
  
  try {
    const healthRes = await fetch(`${WEBHOOK_URL}/health`);
    const health = await healthRes.json();
    
    console.log('📊 Estado del webhook:');
    console.log('- Mensajes del canal almacenados:', health.activeChannelMessages);
    console.log('- Respuestas de thread almacenadas:', health.activeResponses);
    
    // Get channel messages
    const channelRes = await fetch(`${WEBHOOK_URL}/channel-messages/C093FU0CXC5`);
    const channelData = await channelRes.json();
    
    console.log('\n📨 Mensajes del canal encontrados:', channelData.count);
    
    if (channelData.messages.length > 0) {
      channelData.messages.forEach((msg, i) => {
        console.log(`\n[${i + 1}] Mensaje:`);
        console.log('- Usuario:', msg.user);
        console.log('- Texto:', msg.text);
        console.log('- Timestamp:', msg.ts);
      });
    } else {
      console.log('\n❌ No se encontraron mensajes del canal');
      console.log('Esto sugiere que el webhook no está recibiendo eventos de mensajes del canal');
      console.log('\nPosibles causas:');
      console.log('1. La app de Slack no tiene suscripción a eventos "message" sin thread');
      console.log('2. El bot no es miembro del canal');
      console.log('3. Los permisos de la app no incluyen lectura de mensajes del canal');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendUserMessage();