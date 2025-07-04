import crypto from 'crypto';

// Simular un evento de Slack con firma válida
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET || '4d15479c7167be38023b2d6b0a48fe73';

function generateSlackSignature(timestamp, body) {
  const message = `v0:${timestamp}:${body}`;
  const signature = 'v0=' + crypto
    .createHmac('sha256', slackSigningSecret)
    .update(message, 'utf8')
    .digest('hex');
  return signature;
}

// Crear un evento de prueba
const timestamp = Math.floor(Date.now() / 1000);
const event = {
  type: 'event_callback',
  event: {
    type: 'message',
    channel: 'C093FLV2MK7',
    user: 'U123456',
    text: 'Test response from webhook simulator',
    ts: '1751319999.123456',
    thread_ts: '1751319056.385909',
    bot_id: null
  }
};

const body = JSON.stringify(event);
const signature = generateSlackSignature(timestamp, body);

console.log('Sending test event to webhook...');
console.log('Timestamp:', timestamp);
console.log('Signature:', signature);
console.log('Body:', body);

// Enviar el request
fetch('https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/slack/events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Slack-Request-Timestamp': timestamp.toString(),
    'X-Slack-Signature': signature
  },
  body: body
})
.then(res => res.text())
.then(result => {
  console.log('\nResponse:', result);
})
.catch(err => {
  console.error('\nError:', err);
});