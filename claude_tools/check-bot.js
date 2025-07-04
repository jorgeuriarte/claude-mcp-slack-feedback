import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function checkBotMembership() {
  try {
    const info = await client.conversations.info({
      channel: 'C093FLV2MK7',
      include_num_members: true
    });
    
    console.log('Canal:', info.channel.name);
    console.log('El bot es miembro:', info.channel.is_member);
    console.log('Número de miembros:', info.channel.num_members);
    
    if (!info.channel.is_member) {
      console.log('\nIntentando unir el bot al canal...');
      await client.conversations.join({
        channel: 'C093FLV2MK7'
      });
      console.log('Bot unido al canal!');
    } else {
      console.log('\nEl bot YA está en el canal.');
    }
    
    // Listar los primeros miembros
    const members = await client.conversations.members({
      channel: 'C093FLV2MK7',
      limit: 10
    });
    
    console.log('\nPrimeros miembros del canal:');
    for (const member of members.members) {
      const user = await client.users.info({ user: member });
      console.log(`- ${user.user.name} (${member})`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkBotMembership();