/**
 * Cloud Functions entry point - Simplified version
 */

import * as ff from '@google-cloud/functions-framework';
import express from 'express';

const app = express();
app.use(express.json());

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

// Register the function with the correct name
ff.http('mcp', app);