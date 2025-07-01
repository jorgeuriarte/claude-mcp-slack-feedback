import crypto from 'crypto';

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET || '4d15479c7167be38023b2d6b0a48fe73';
const webhookUrl = 'https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/slack/events';

function generateSlackSignature(timestamp, body) {
  const message = `v0:${timestamp}:${body}`;
  const signature = 'v0=' + crypto
    .createHmac('sha256', slackSigningSecret)
    .update(message, 'utf8')
    .digest('hex');
  return signature;
}

async function sendSlackEvent(event) {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(event);
  const signature = generateSlackSignature(timestamp, body);
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Slack-Request-Timestamp': timestamp.toString(),
      'X-Slack-Signature': signature
    },
    body: body
  });
  
  return response.text();
}

async function testFullFlow() {
  const threadTs = '1751355000.111111';
  const sessionId = 'test-session-123';
  
  console.log('=== Testing Full Flow with Session ID Extraction ===\n');
  
  // 1. Send thread starter with session ID
  console.log('1. Sending thread starter with session ID...');
  const threadStarter = {
    type: 'event_callback',
    event: {
      type: 'message',
      channel: 'C093FLV2MK7',
      user: 'B123456', // Bot user
      text: `🤖 **Question from Claude [Session: ${sessionId}]**\nTest question for session extraction`,
      ts: threadTs,
      thread_ts: threadTs,
      bot_id: 'B123456'
    }
  };
  
  let result = await sendSlackEvent(threadStarter);
  console.log('Thread starter response:', result);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 2. Send user response
  console.log('\n2. Sending user response...');
  const userResponse = {
    type: 'event_callback',
    event: {
      type: 'message',
      channel: 'C093FLV2MK7',
      user: 'U789012',
      text: 'This is my response to the question',
      ts: '1751355001.222222',
      thread_ts: threadTs,
      bot_id: null
    }
  };
  
  result = await sendSlackEvent(userResponse);
  console.log('User response result:', result);
  
  // 3. Check if response was stored with correct session ID
  console.log('\n3. Checking stored responses...');
  
  // Check under session ID
  const sessionResponse = await fetch(`https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/responses/${sessionId}/${threadTs}`);
  const sessionData = await sessionResponse.json();
  console.log(`\nResponses under session ID (${sessionId}):`, JSON.stringify(sessionData, null, 2));
  
  // Also check under channel ID for comparison
  const channelResponse = await fetch(`https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/responses/C093FLV2MK7/${threadTs}`);
  const channelData = await channelResponse.json();
  console.log(`\nResponses under channel ID:`, JSON.stringify(channelData, null, 2));
}

testFullFlow().catch(console.error);