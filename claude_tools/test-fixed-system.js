import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function testFixedSystem() {
  try {
    const sessionId = 'test-fixed-' + Date.now().toString().slice(-6);
    
    // Send a question
    const result = await client.chat.postMessage({
      channel: 'C093FLV2MK7',
      text: `🤖 **Test del sistema arreglado [Session: ${sessionId}]**\n\n¿Funciona ahora el sistema de respuestas? Responde "SÍ FUNCIONA" si ves este mensaje.\n\n_Please reply in this thread_`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🤖 *Test del sistema arreglado*\n*Session:* ${sessionId}\n*User:* jorge`
          }
        },
        {
          type: "divider"
        },
        {
          type: "section", 
          text: {
            type: "mrkdwn",
            text: "¿Funciona ahora el sistema de respuestas?\n\nResponde *SÍ FUNCIONA* si ves este mensaje."
          }
        }
      ]
    });
    
    const threadTs = result.ts;
    console.log('✅ Mensaje enviado!');
    console.log('Thread:', threadTs);
    console.log('Session:', sessionId);
    console.log('\n⏳ Esperando respuesta...\n');
    
    // Poll usando threadTs como clave
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      
      try {
        // Usar threadTs:threadTs como clave
        const url = `https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/responses/${threadTs}/${threadTs}`;
        const response = await fetch(url);
        const data = await response.json();
        
        console.log(`Intento ${attempts}: ${data.responses?.length || 0} respuestas`);
        
        if (data.responses && data.responses.length > 0) {
          console.log('\n✅ ¡RESPUESTA RECIBIDA!');
          console.log('Usuario:', data.responses[0].user);
          console.log('Texto:', data.responses[0].text);
          console.log('\n🎉 ¡EL SISTEMA FUNCIONA CORRECTAMENTE!');
          clearInterval(interval);
          return;
        }
      } catch (error) {
        console.error('Error:', error.message);
      }
      
      if (attempts >= 30) {
        console.log('\n⏱️ Timeout - no se recibió respuesta');
        clearInterval(interval);
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFixedSystem();