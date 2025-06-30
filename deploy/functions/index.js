#!/usr/bin/env node

// Cloud Functions entry point for MCP server
// This wraps the MCP server to work with Cloud Functions

import { http } from '@google-cloud/functions-framework';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MCP server state
let mcpProcess = null;
let isInitializing = false;

// Initialize MCP server process
async function initMCPServer() {
  if (mcpProcess || isInitializing) return;
  
  isInitializing = true;
  
  try {
    const serverPath = join(__dirname, 'dist', 'index.js');
    
    // Spawn MCP server as child process
    mcpProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        MCP_MODE: 'polling', // Force polling mode in Cloud Functions
        MCP_FUNCTION_MODE: 'true'
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });
    
    mcpProcess.stdout.on('data', (data) => {
      console.log(`MCP stdout: ${data}`);
    });
    
    mcpProcess.stderr.on('data', (data) => {
      console.error(`MCP stderr: ${data}`);
    });
    
    mcpProcess.on('exit', (code) => {
      console.log(`MCP process exited with code ${code}`);
      mcpProcess = null;
      isInitializing = false;
    });
    
    // Wait for server to be ready
    await new Promise((resolve) => {
      mcpProcess.once('message', (msg) => {
        if (msg === 'ready') resolve();
      });
      setTimeout(resolve, 5000); // Timeout after 5s
    });
    
  } finally {
    isInitializing = false;
  }
}

// Cloud Function HTTP endpoint
http('mcp', async (req, res) => {
  try {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Initialize server if needed
    await initMCPServer();

    // Handle health check
    if (req.path === '/health') {
      res.json({
        status: 'healthy',
        service: 'claude-mcp-slack-feedback',
        version: process.env.VERSION || '1.3.1',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Handle MCP protocol over HTTP
    if (req.method === 'POST' && req.path === '/mcp') {
      if (!mcpProcess) {
        res.status(503).json({ error: 'MCP server not ready' });
        return;
      }
      
      // Forward request to MCP process via IPC
      mcpProcess.send({ type: 'request', body: req.body });
      
      // Wait for response
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MCP request timeout'));
        }, 30000);
        
        mcpProcess.once('message', (msg) => {
          if (msg.type === 'response') {
            clearTimeout(timeout);
            resolve(msg.body);
          }
        });
      });
      
      res.json(response);
      return;
    }

    // Note: Webhook mode not supported in Cloud Functions
    if (req.path === '/slack/events') {
      res.status(501).json({
        error: 'Webhook mode not supported',
        message: 'Cloud Functions deployment uses polling mode only'
      });
      return;
    }

    // Default response
    res.status(404).json({
      error: 'Not found',
      message: 'Use POST /mcp for MCP protocol or /health for health check'
    });

  } catch (error) {
    console.error('Cloud Function error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  if (mcpProcess) {
    mcpProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (mcpProcess) {
      mcpProcess.kill('SIGKILL');
    }
  }
  process.exit(0);
});