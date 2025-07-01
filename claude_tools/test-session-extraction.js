import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function testSessionExtraction() {
  try {
    // Send a message with session ID in the format
    const result = await client.chat.postMessage({
      channel: 'C093FLV2MK7',
      text: '🤖 **Question from Claude [Session: test123]**\nThis is a test message to verify session ID extraction.\n\n_Please reply in this thread_',
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "[test123]\n🤖 *Question from Claude*\n*User:* jorge"
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "This is a test message to verify session ID extraction works correctly."
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
    
    console.log('Message sent!');
    console.log('Channel:', result.channel);
    console.log('Timestamp:', result.ts);
    console.log('\nPlease reply to this message in Slack.');
    console.log('\nAfter replying, check responses at:');
    console.log(`https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/responses/test123/${result.ts}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSessionExtraction();