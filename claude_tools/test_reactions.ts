#!/usr/bin/env ts-node

import { WebClient } from '@slack/web-api';
import * as dotenv from 'dotenv';

dotenv.config();

async function testReactions() {
  const token = process.env.SLACK_BOT_TOKEN || '';
  const client = new WebClient(token);
  
  console.log('Testing Slack reactions...\n');
  
  try {
    // 1. First, let's find the correct channel
    const channelsResult = await client.conversations.list({
      types: 'public_channel,private_channel',
      limit: 1000
    });
    
    const targetChannel = channelsResult.channels?.find(
      c => c.name === 'claude-jorge-main'
    );
    
    if (!targetChannel) {
      console.error('❌ Channel claude-jorge-main not found');
      return;
    }
    
    console.log(`✅ Found channel: ${targetChannel.name} (ID: ${targetChannel.id})`);
    
    // 2. Get recent messages from the channel
    const historyResult = await client.conversations.history({
      channel: targetChannel.id!,
      limit: 10
    });
    
    if (!historyResult.messages || historyResult.messages.length === 0) {
      console.error('❌ No messages found in channel');
      return;
    }
    
    console.log(`\n📝 Recent messages in channel:`);
    historyResult.messages.slice(0, 3).forEach((msg, index) => {
      console.log(`\n${index + 1}. Message:`);
      console.log(`   Text: ${msg.text?.substring(0, 50)}...`);
      console.log(`   Timestamp: ${msg.ts}`);
      console.log(`   User: ${msg.user}`);
    });
    
    // 3. Try to add a reaction to the most recent message
    const targetMessage = historyResult.messages[0];
    console.log(`\n🎯 Attempting to add reaction to message with timestamp: ${targetMessage.ts}`);
    
    try {
      await client.reactions.add({
        channel: targetChannel.id!,
        timestamp: targetMessage.ts!,
        name: 'thumbsup'
      });
      console.log('✅ Successfully added thumbsup reaction!');
    } catch (error: any) {
      console.error('❌ Failed to add reaction:', error.message);
      if (error.data) {
        console.error('   Error details:', error.data);
      }
    }
    
    // 4. Test with different timestamp formats
    console.log('\n🧪 Testing timestamp formats:');
    const timestamps = [
      targetMessage.ts, // Original format
      parseFloat(targetMessage.ts!).toString(), // Numeric format
      targetMessage.ts!.replace('.', '_'), // Underscore format
    ];
    
    for (const ts of timestamps) {
      console.log(`\n   Testing timestamp: ${ts}`);
      try {
        await client.reactions.add({
          channel: targetChannel.id!,
          timestamp: ts,
          name: 'eyes'
        });
        console.log(`   ✅ Success with format: ${ts}`);
        break;
      } catch (error: any) {
        console.log(`   ❌ Failed with format: ${ts} - ${error.message}`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run the test
testReactions().catch(console.error);