import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function finalTest() {
  try {
    const timestamp = Date.now().toString();
    const sessionId = 'final-' + timestamp.slice(-6);
    
    // Send test message
    const result = await client.chat.postMessage({
      channel: 'C093FLV2MK7',
      text: `🎯 **Prueba final con async fix [Session: ${sessionId}]**\n\nPor favor responde "FUNCIONA" para confirmar que el sistema está operativo.\n\n_Reply in thread_`
    });
    
    const threadTs = result.ts;
    console.log('✅ Mensaje enviado!');
    console.log('Thread:', threadTs);
    console.log('\n⏳ Esperando tu respuesta...\n');
    
    // Poll for response
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      
      try {
        const url = `https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/responses/${threadTs}/${threadTs}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.responses && data.responses.length > 0) {
          console.log('\n🎉 ¡RESPUESTA RECIBIDA!');
          console.log('Usuario:', data.responses[0].user);
          console.log('Texto:', data.responses[0].text);
          console.log('Timestamp:', data.responses[0].ts);
          console.log('\n✅ ¡SISTEMA COMPLETAMENTE FUNCIONAL!');
          clearInterval(interval);
          process.exit(0);
        }
        
        process.stdout.write(`\rIntento ${attempts}/30...`);
      } catch (error) {
        console.error('\nError:', error.message);
      }
      
      if (attempts >= 30) {
        console.log('\n\n⏱️ Timeout - verifica los logs');
        clearInterval(interval);
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

finalTest();