import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function testAfterReset() {
  try {
    const sessionId = 'reset-test-' + Date.now().toString().slice(-6);
    
    // Send a message with session ID in the format
    const result = await client.chat.postMessage({
      channel: 'C093FLV2MK7',
      text: `🤖 **Question from Claude [Session: ${sessionId}]**\n\nTesting webhook after URL reset. Please reply to confirm webhooks are working.\n\n_Please reply in this thread_`,
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
            text: "Testing webhook after URL reset. Please reply to confirm webhooks are working."
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
    
    console.log('✅ Message sent successfully!');
    console.log('Channel:', result.channel);
    console.log('Thread timestamp:', result.ts);
    console.log('Session ID:', sessionId);
    console.log('\n📝 Please reply to this message in Slack.');
    console.log('\n🔍 I will check for responses in 20 seconds...');
    console.log(`\nDirect URL: https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/responses/${sessionId}/${result.ts}`);
    
    // Store the details for checking
    return {
      sessionId,
      threadTs: result.ts,
      channel: result.channel
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testAfterReset();