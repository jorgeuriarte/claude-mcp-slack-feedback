#!/usr/bin/env node

/**
 * Ultra-simple HTTP server for Cloud Functions
 * Just to test deployment
 */

import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'claude-mcp-slack-feedback',
    version: process.env.VERSION || '1.3.1',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'claude-mcp-slack-feedback',
    version: process.env.VERSION || '1.3.1',
    mode: 'cloud-functions',
    timestamp: new Date().toISOString()
  });
});

// MCP endpoint (placeholder)
app.post('/mcp', (req, res) => {
  res.json({
    error: 'MCP functionality not yet implemented in Cloud Functions',
    message: 'This is a test deployment'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Export for Cloud Functions
export default app;