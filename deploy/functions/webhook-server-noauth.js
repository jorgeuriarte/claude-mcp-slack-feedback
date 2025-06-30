/**
 * Temporal: Webhook server sin verificación de firma para testing
 */

import * as ff from '@google-cloud/functions-framework';
import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory storage
const responseStore = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'claude-mcp-slack-feedback',
    mode: 'webhook-receiver-noauth',
    timestamp: new Date().toISOString(),
    activeResponses: responseStore.size
  });
});

// Slack events - SIN VERIFICACIÓN (solo para testing)
app.post('/slack/events', (req, res) => {
  console.log('Received webhook:', JSON.stringify(req.body, null, 2));
  
  const { type, challenge, event } = req.body;
  
  // URL verification
  if (type === 'url_verification') {
    return res.send(challenge);
  }
  
  // Handle events
  if (type === 'event_callback' && event) {
    if (event.type === 'message' && event.thread_ts && !event.bot_id) {
      // Extract session from channel name
      const channelMatch = event.channel_name?.match(/^claude-(.+)-(.+)$/);
      if (channelMatch) {
        const [, username, sessionId] = channelMatch;
        const key = `${sessionId}:${event.thread_ts}`;
        
        responseStore.set(key, {
          timestamp: Date.now(),
          response: {
            user: event.user,
            text: event.text,
            ts: event.ts,
            threadTs: event.thread_ts,
            channel: event.channel,
            channelName: event.channel_name
          }
        });
        
        console.log(`Stored response for ${sessionId}:${event.thread_ts}`);
      }
    }
  }
  
  res.status(200).send('ok');
});

// Get responses
app.get('/responses/:sessionId/:threadTs?', (req, res) => {
  const { sessionId, threadTs } = req.params;
  const since = req.query.since ? parseInt(req.query.since) : 0;
  
  const responses = [];
  const keyPrefix = threadTs ? `${sessionId}:${threadTs}` : `${sessionId}:`;
  
  for (const [key, data] of responseStore.entries()) {
    if (key.startsWith(keyPrefix) && data.timestamp > since) {
      responses.push({
        ...data.response,
        timestamp: data.timestamp
      });
    }
  }
  
  res.json({
    sessionId,
    threadTs,
    responses,
    hasMore: false,
    lastTimestamp: responses.length > 0 ? responses[responses.length - 1].timestamp : since
  });
});

ff.http('mcp', app);