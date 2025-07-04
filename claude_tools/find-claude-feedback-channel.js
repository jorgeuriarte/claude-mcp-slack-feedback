import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function findChannel() {
  try {
    const result = await client.conversations.list({
      types: 'public_channel',
      limit: 200
    });
    
    const claudeFeedback = result.channels.find(c => c.name === 'claude-feedback');
    
    if (claudeFeedback) {
      console.log('✅ Canal encontrado:');
      console.log('- Nombre:', claudeFeedback.name);
      console.log('- ID:', claudeFeedback.id);
      console.log('- Es miembro:', claudeFeedback.is_member);
    } else {
      console.log('❌ No se encontró el canal claude-feedback');
      console.log('\nCanales disponibles:');
      result.channels
        .filter(c => c.name.includes('claude'))
        .forEach(c => console.log(`- ${c.name} (${c.id})`));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findChannel();