import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function checkBotMembership() {
  try {
    // Get bot user ID
    const auth = await client.auth.test();
    console.log('🤖 Bot Info:');
    console.log('- User ID:', auth.user_id);
    console.log('- Bot ID:', auth.bot_id);
    
    // Check channel membership
    const channelInfo = await client.conversations.info({
      channel: 'C093FU0CXC5'
    });
    
    console.log('\n📍 Canal #claude-feedback:');
    console.log('- ID:', channelInfo.channel.id);
    console.log('- Nombre:', channelInfo.channel.name);
    console.log('- Es miembro:', channelInfo.channel.is_member);
    
    // Get channel members
    const members = await client.conversations.members({
      channel: 'C093FU0CXC5'
    });
    
    const isBotMember = members.members.includes(auth.user_id);
    console.log('\n👥 Membresía:');
    console.log('- Total de miembros:', members.members.length);
    console.log('- Bot es miembro:', isBotMember);
    
    if (!isBotMember) {
      console.log('\n⚠️  El bot NO es miembro del canal!');
      console.log('Esto explica por qué no recibe eventos de mensajes del canal.');
      console.log('\nSolución: Invitar al bot al canal con /invite @Claude MCP Feedback');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBotMembership();