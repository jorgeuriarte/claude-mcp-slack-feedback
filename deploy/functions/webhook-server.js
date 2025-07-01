/**
 * Cloud Functions webhook server for Slack responses
 * Stores responses in memory for polling by MCP clients
 */

import * as ff from '@google-cloud/functions-framework';
import express from 'express';
import crypto from 'crypto';

// No dotenv in production - Cloud Functions sets env vars

const app = express();
// Store raw body for signature verification
app.use(express.raw({ type: 'application/json' }));
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'application/json' && Buffer.isBuffer(req.body)) {
    req.rawBody = req.body.toString('utf8');
    try {
      req.body = JSON.parse(req.rawBody);
    } catch (e) {
      console.error('Failed to parse JSON body:', e);
      req.body = {};
    }
  }
  next();
});

// In-memory storage for responses (consider using Firestore for production)
const responseStore = new Map();
const RESPONSE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup old responses periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of responseStore.entries()) {
    if (now - data.timestamp > RESPONSE_TTL) {
      responseStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // Every hour

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'claude-mcp-slack-feedback',
    version: process.env.VERSION || '1.3.1',
    mode: 'webhook-receiver',
    timestamp: new Date().toISOString(),
    activeResponses: responseStore.size
  });
});

// Slack URL verification
app.post('/slack/events', async (req, res) => {
  const { type, challenge, token } = req.body;
  
  // URL verification challenge
  if (type === 'url_verification') {
    console.log('Slack URL verification challenge received');
    return res.send(challenge);
  }
  
  // Verify Slack signature
  const signature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];
  
  if (!verifySlackSignature(req, signature, timestamp)) {
    console.error('Invalid Slack signature');
    return res.status(401).send('Unauthorized');
  }
  
  // Handle Slack events
  if (type === 'event_callback') {
    // For JSON format, the event is directly in the body
    const { event } = req.body;
    
    // We're interested in messages in threads
    if (event && event.type === 'message' && event.thread_ts) {
      await handleSlackMessage(event);
    }
  }
  
  // Always respond quickly to Slack
  res.status(200).send('ok');
});

// Get responses for a session (polling endpoint)
app.get('/responses/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const since = req.query.since ? parseInt(req.query.since) : 0;
  
  // Get all responses for this session
  const responses = [];
  const keyPrefix = `${sessionId}:`;
  
  for (const [key, data] of responseStore.entries()) {
    if (key.startsWith(keyPrefix) && data.timestamp > since) {
      responses.push({
        ...data.response,
        timestamp: data.timestamp
      });
    }
  }
  
  // Sort by timestamp
  responses.sort((a, b) => a.timestamp - b.timestamp);
  
  res.json({
    sessionId,
    responses,
    hasMore: false,
    lastTimestamp: responses.length > 0 ? responses[responses.length - 1].timestamp : since
  });
});

// Get responses for a specific thread (more granular polling)
app.get('/responses/:sessionId/:threadTs', (req, res) => {
  const { sessionId, threadTs } = req.params;
  const since = req.query.since ? parseInt(req.query.since) : 0;
  
  const key = `${sessionId}:${threadTs}`;
  const data = responseStore.get(key);
  
  if (!data || data.timestamp <= since) {
    return res.json({
      sessionId,
      threadTs,
      responses: [],
      hasMore: false,
      lastTimestamp: since
    });
  }
  
  res.json({
    sessionId,
    threadTs,
    responses: [data.response],
    hasMore: false,
    lastTimestamp: data.timestamp
  });
});

// Store a response (for testing/debugging)
app.post('/responses/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { threadTs, response } = req.body;
  
  if (!threadTs || !response) {
    return res.status(400).json({ error: 'Missing threadTs or response' });
  }
  
  const key = `${sessionId}:${threadTs}`;
  responseStore.set(key, {
    timestamp: Date.now(),
    response
  });
  
  res.json({ 
    success: true, 
    sessionId, 
    threadTs,
    stored: true 
  });
});

// Clear responses for a session (cleanup)
app.delete('/responses/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const keyPrefix = `${sessionId}:`;
  let deleted = 0;
  
  for (const key of responseStore.keys()) {
    if (key.startsWith(keyPrefix)) {
      responseStore.delete(key);
      deleted++;
    }
  }
  
  res.json({ 
    success: true, 
    sessionId, 
    deleted 
  });
});

// Store thread starters for session extraction
const threadStarters = new Map();

// Helper function to handle Slack messages
async function handleSlackMessage(event) {
  console.log('Processing Slack message event:', JSON.stringify(event, null, 2));
  
  const threadTs = event.thread_ts;
  
  // Store thread starters
  if (event.ts === event.thread_ts && event.bot_id) {
    // This is a thread starter from Claude
    // Extract session ID from the message text
    const sessionMatch = event.text?.match(/\[Session:\s*([^\]]+)\]/i);
    if (sessionMatch) {
      const sessionId = sessionMatch[1].trim();
      threadStarters.set(threadTs, sessionId);
      console.log(`Stored thread starter ${threadTs} with session ID ${sessionId}`);
    }
  }
  
  // Skip bot messages and thread starters
  if (event.bot_id || event.ts === event.thread_ts) {
    console.log('Skipping bot message or thread starter');
    return;
  }
  
  // Try to extract session ID from the stored thread starters
  let sessionId = threadStarters.get(threadTs);
  
  // For thread messages, we need to look at the parent message
  if (event.thread_ts && event.ts !== event.thread_ts) {
    const response = {
      user: event.user,
      text: event.text,
      ts: event.ts,
      threadTs: event.thread_ts,
      channel: event.channel
    };
    
    const timestamp = Date.now();
    const responseData = { timestamp, response };
    
    // Store under multiple keys for flexible retrieval
    const keys = [];
    
    // 1. Primary: sessionId:threadTs (if we have session ID)
    if (sessionId) {
      keys.push(`${sessionId}:${event.thread_ts}`);
    }
    
    // 2. Thread-based: use threadTs as session ID  
    keys.push(`${event.thread_ts}:${event.thread_ts}`);
    
    // 3. Channel-based fallback
    keys.push(`${event.channel}:${event.thread_ts}`);
    
    // Store under all keys
    keys.forEach(key => {
      responseStore.set(key, responseData);
      console.log(`Stored response under key: ${key}`);
    });
    
    if (!sessionId) {
      console.log('No session ID found in thread starter, will use threadTs as primary key');
    }
    
    return; // Exit early since we handled storage
  }
  
  // Non-thread messages (shouldn't normally happen in our use case)
  if (!sessionId) {
    const channelToSession = {
      'C093FLV2MK7': 'main',
      'C093FU0CXC5': 'feedback',
      'C093HQMJUUS': '3300b7437a1e0199'
    };
    
    sessionId = channelToSession[event.channel] || event.channel;
  }
  
  // Store the response
  const key = `${sessionId}:${threadTs}`;
  const response = {
    user: event.user,
    text: event.text,
    ts: event.ts,
    threadTs: event.thread_ts,
    channel: event.channel
  };
  
  responseStore.set(key, {
    timestamp: Date.now(),
    response
  });
  
  console.log(`Stored response for session ${sessionId}, thread ${threadTs}, channel ${event.channel}`);
}

// Verify Slack request signature
function verifySlackSignature(req, signature, timestamp) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  console.log('Signing secret length:', signingSecret ? signingSecret.length : 0);
  if (!signingSecret || signingSecret.trim() === '') {
    console.error('SLACK_SIGNING_SECRET not configured or empty');
    return false;
  }
  
  // Check timestamp to prevent replay attacks
  const requestTimestamp = parseInt(timestamp);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - requestTimestamp) > 60 * 5) {
    console.error('Request timestamp too old');
    return false;
  }
  
  // Compute signature using raw body
  const body = req.rawBody || JSON.stringify(req.body);
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring, 'utf8')
    .digest('hex');
  
  // Compare signatures
  try {
    return crypto.timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch (error) {
    // If lengths don't match, signatures are different
    console.error('Signature comparison failed:', error.message);
    return false;
  }
}

// Register the function
ff.http('mcp', app);

// Export for testing
export default app;