#!/usr/bin/env node

/**
 * Simplified MCP wrapper for Cloud Functions
 * This provides a stateless HTTP interface to the MCP server
 */

import express from 'express';
import { ConfigManager } from './dist/config-manager.js';
import { SlackClient } from './dist/slack-client.js';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// Initialize core components
const configManager = new ConfigManager();
const slackClient = new SlackClient(configManager, null);

// Initialize on startup
await configManager.init();
await slackClient.init();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'claude-mcp-slack-feedback',
    version: process.env.VERSION || '1.3.1',
    mode: 'polling-only',
    timestamp: new Date().toISOString()
  });
});

// MCP tool endpoints
app.post('/mcp/setup_slack_config', async (req, res) => {
  try {
    const { botToken, workspaceUrl } = req.body;
    const { workspaceUrl: url, teamId } = await slackClient.setToken(botToken, workspaceUrl);
    
    res.json({
      success: true,
      workspace: url,
      teamId: teamId
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

app.post('/mcp/ask_feedback', async (req, res) => {
  try {
    const { question, context, options, channel } = req.body;
    
    if (!channel) {
      throw new Error('Channel is required for stateless operation');
    }
    
    // Create temporary session ID
    const sessionId = uuidv4();
    
    // Send to Slack
    const request = {
      sessionId,
      question,
      context,
      options,
      timestamp: Date.now()
    };
    
    const threadTs = await slackClient.sendFeedbackToChannel(request, channel);
    
    // In stateless mode, return immediately with polling instructions
    res.json({
      success: true,
      sessionId,
      threadTs,
      channel,
      message: 'Question sent. Poll /mcp/get_responses with sessionId and threadTs to check for responses.'
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

app.post('/mcp/get_responses', async (req, res) => {
  try {
    const { channel, threadTs, since } = req.body;
    
    if (!channel || !threadTs) {
      throw new Error('Channel and threadTs are required');
    }
    
    // Poll for messages in thread
    const messages = await slackClient.getThreadMessages(channel, threadTs, since);
    
    res.json({
      success: true,
      responses: messages,
      hasMore: false // In polling mode, we don't track state
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

app.post('/mcp/list_channels', async (req, res) => {
  try {
    const channels = await slackClient.listChannels();
    
    res.json({
      success: true,
      channels: channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        isMember: ch.is_member
      }))
    });
    
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Generic MCP endpoint handler
app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;
  
  // Route to specific handler based on method
  switch (method) {
    case 'setup_slack_config':
      req.body = params;
      return app._router.handle(req, res, () => {}, '/mcp/setup_slack_config', 'POST');
      
    case 'ask_feedback':
      req.body = params;
      return app._router.handle(req, res, () => {}, '/mcp/ask_feedback', 'POST');
      
    case 'get_responses':
      req.body = params;
      return app._router.handle(req, res, () => {}, '/mcp/get_responses', 'POST');
      
    case 'list_channels':
      req.body = params;
      return app._router.handle(req, res, () => {}, '/mcp/list_channels', 'POST');
      
    default:
      res.status(404).json({
        error: `Unknown method: ${method}`
      });
  }
});

// Start server if running locally
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`MCP wrapper listening on port ${port}`);
  });
}

// Export for Cloud Functions
export default app;