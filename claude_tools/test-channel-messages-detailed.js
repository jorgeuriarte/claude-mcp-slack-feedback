import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const WEBHOOK_URL = 'https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app';

async function testChannelMessages() {
  console.log('🔍 Testing channel message handling...\n');
  
  try {
    // 1. Send a bot message
    const botMessage = await client.chat.postMessage({
      channel: 'C093FU0CXC5',
      text: '🤖 Bot message for testing - ' + new Date().toISOString()
    });
    console.log('✅ Bot message sent:', botMessage.ts);
    
    // 2. Wait and check
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Check webhook health
    const healthRes = await fetch(`${WEBHOOK_URL}/health`);
    const health = await healthRes.json();
    console.log('\n📊 After bot message:');
    console.log('- Channel messages stored:', health.activeChannelMessages);
    console.log('- Thread responses stored:', health.activeResponses);
    
    // 4. Check channel messages endpoint
    const channelRes = await fetch(`${WEBHOOK_URL}/channel-messages/C093FU0CXC5`);
    const channelData = await channelRes.json();
    console.log('- Messages from endpoint:', channelData.count);
    
    // 5. Now simulate a user message (you need to send one manually)
    console.log('\n📝 Por favor, envía un mensaje de USUARIO (no bot) al canal #claude-feedback');
    console.log('Esperando 10 segundos para que puedas enviar el mensaje...\n');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 6. Check again after user message
    const healthRes2 = await fetch(`${WEBHOOK_URL}/health`);
    const health2 = await healthRes2.json();
    console.log('📊 After user message:');
    console.log('- Channel messages stored:', health2.activeChannelMessages);
    console.log('- Thread responses stored:', health2.activeResponses);
    
    // 7. Get channel messages again
    const channelRes2 = await fetch(`${WEBHOOK_URL}/channel-messages/C093FU0CXC5`);
    const channelData2 = await channelRes2.json();
    console.log('- Messages from endpoint:', channelData2.count);
    
    if (channelData2.messages.length > 0) {
      console.log('\n📨 Channel messages found:');
      channelData2.messages.forEach((msg, i) => {
        console.log(`\n[${i + 1}] User: ${msg.user}`);
        console.log(`    Text: ${msg.text}`);
        console.log(`    Timestamp: ${msg.ts}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testChannelMessages();