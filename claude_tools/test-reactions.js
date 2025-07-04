import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function testReactions() {
  try {
    // 1. Enviar mensaje de prueba
    const result = await client.chat.postMessage({
      channel: 'C093FLV2MK7',
      text: '🧪 Test de reacciones: Este mensaje recibirá varias reacciones automáticas'
    });
    
    console.log('✅ Mensaje enviado:', result.ts);
    
    // 2. Añadir diferentes reacciones
    const reactions = [
      'white_check_mark',     // ✅
      'eyes',                 // 👀
      'thinking_face',        // 🤔
      'rocket',               // 🚀
      'thumbsup'              // 👍
    ];
    
    for (const reaction of reactions) {
      try {
        await client.reactions.add({
          channel: result.channel,
          timestamp: result.ts,
          name: reaction
        });
        console.log(`✅ Reacción añadida: :${reaction}:`);
        
        // Pequeña pausa entre reacciones
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error con :${reaction}::`, error.message);
      }
    }
    
    console.log('\n🎯 Caso de uso real:');
    console.log('Cuando alguien responde en el canal, podemos:');
    console.log('1. Reaccionar con ✅ para confirmar que recibimos la respuesta');
    console.log('2. Usar 🤔 si no estamos seguros');
    console.log('3. Usar ❓ para pedir aclaración');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.data?.error === 'missing_scope') {
      console.log('\n⚠️  Necesitas añadir el scope "reactions:write" a tu Slack app');
      console.log('1. Ve a https://api.slack.com/apps/A093FLET1S9');
      console.log('2. OAuth & Permissions > Scopes > Bot Token Scopes');
      console.log('3. Añade "reactions:write"');
      console.log('4. Reinstala la app en tu workspace');
    }
  }
}

testReactions();