import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function testCompleteSystem() {
  try {
    const sessionId = 'final-test-' + Date.now().toString().slice(-6);
    
    // Send a question with session ID
    const result = await client.chat.postMessage({
      channel: 'C093FLV2MK7',
      text: `🤖 **Question from Claude [Session: ${sessionId}]**\n\n¿El sistema de webhooks está funcionando correctamente? Por favor responde "Sí funciona" o "No funciona".\n\n_Please reply in this thread_`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🤖 *Question from Claude* [Session: ${sessionId}]\n*User:* jorge`
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "¿El sistema de webhooks está funcionando correctamente?\n\nPor favor responde:\n• *Sí funciona* - si ves este mensaje\n• *No funciona* - si hay algún problema"
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "_Please reply in this thread_"
            }
          ]
        }
      ]
    });
    
    console.log('✅ Pregunta enviada a Slack!');
    console.log('Channel:', result.channel);
    console.log('Thread:', result.ts);
    console.log('Session ID:', sessionId);
    console.log('\n⏳ Esperando tu respuesta...\n');
    
    // Poll for responses
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    const checkResponses = async () => {
      const url = `https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/responses/${sessionId}/${result.ts}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.responses && data.responses.length > 0) {
        console.log('✅ ¡Respuesta recibida!');
        console.log('Usuario:', data.responses[0].user);
        console.log('Texto:', data.responses[0].text);
        console.log('\n🎉 ¡El sistema funciona correctamente!');
        return true;
      }
      return false;
    };
    
    // Check every second
    const interval = setInterval(async () => {
      attempts++;
      
      if (await checkResponses()) {
        clearInterval(interval);
        return;
      }
      
      if (attempts >= maxAttempts) {
        console.log('⏱️ Timeout - no se recibió respuesta en 30 segundos');
        console.log('Verifica que el webhook esté funcionando correctamente');
        clearInterval(interval);
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCompleteSystem();