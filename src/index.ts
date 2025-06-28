#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigManager } from './config-manager.js';
import { SessionManager } from './session-manager.js';
import { SlackClient } from './slack-client.js';
import { TunnelManager } from './tunnel-manager.js';
import { WebhookServer } from './webhook-server.js';
import { MCPToolParams, FeedbackRequest } from './types.js';
import { config } from 'dotenv';

config();

class SlackFeedbackMCPServer {
  private server: Server;
  private configManager: ConfigManager;
  private sessionManager: SessionManager;
  private slackClient: SlackClient;
  private tunnelManager?: TunnelManager;
  private webhookServer?: WebhookServer;

  constructor() {
    this.server = new Server(
      {
        name: 'claude-mcp-slack-feedback',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.configManager = new ConfigManager();
    this.sessionManager = new SessionManager(this.configManager);
    this.slackClient = new SlackClient(this.configManager, this.sessionManager);
    
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'setup_slack_config',
          description: 'Configure Slack workspace connection (required for first-time setup)',
          inputSchema: {
            type: 'object',
            properties: {
              botToken: {
                type: 'string',
                description: 'Slack bot token (starts with xoxb-)',
              },
              workspaceUrl: {
                type: 'string',
                description: 'Slack workspace URL (e.g., myteam.slack.com)',
              },
            },
            required: ['botToken', 'workspaceUrl'],
          },
        },
        {
          name: 'ask_feedback',
          description: 'Send a question to Slack for human feedback',
          inputSchema: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'The question to ask',
              },
              context: {
                type: 'string',
                description: 'Optional context to help the human understand the question',
              },
              options: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional list of suggested responses',
              },
            },
            required: ['question'],
          },
        },
        {
          name: 'update_progress',
          description: 'Update the Slack thread with progress information',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Progress update message',
              },
              threadTs: {
                type: 'string',
                description: 'Thread timestamp from previous message',
              },
            },
            required: ['message', 'threadTs'],
          },
        },
        {
          name: 'get_responses',
          description: 'Get responses from Slack (uses webhook or polling based on configuration)',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Optional session ID to get responses for specific session',
              },
              since: {
                type: 'number',
                description: 'Optional timestamp to get responses since',
              },
            },
          },
        },
        {
          name: 'list_sessions',
          description: 'List all active sessions',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'setup_slack_config':
            return await this.setupSlackConfig(args as MCPToolParams['setupSlackConfig']);
          
          case 'ask_feedback':
            return await this.askFeedback(args as MCPToolParams['askFeedback']);
          
          case 'update_progress':
            return await this.updateProgress(args as MCPToolParams['updateProgress']);
          
          case 'get_responses':
            return await this.getResponses(args as MCPToolParams['getResponses']);
          
          case 'list_sessions':
            return await this.listSessions();
          
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool ${name} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async setupSlackConfig(params: MCPToolParams['setupSlackConfig']) {
    try {
      const { workspaceUrl, teamId } = await this.slackClient.setToken(params.botToken);
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Slack configuration saved!\n\nWorkspace: ${workspaceUrl}\nTeam ID: ${teamId}\n\nYou can now use the ask_feedback tool to request human feedback.`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Failed to configure Slack: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async askFeedback(params: MCPToolParams['askFeedback']) {
    await this.ensureSession();
    
    const session = await this.sessionManager.getCurrentSession();
    if (!session) {
      throw new McpError(ErrorCode.InternalError, 'No active session');
    }

    const request: FeedbackRequest = {
      sessionId: session.sessionId,
      question: params.question,
      context: params.context,
      options: params.options,
      timestamp: Date.now()
    };

    const threadTs = await this.slackClient.sendFeedback(request);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Question sent to Slack!\n\nSession: ${session.sessionId}\nChannel: #${session.channelId}\nThread: ${threadTs}\nMode: ${session.mode}\n\nUse get_responses to retrieve the answer.`,
        },
      ],
    };
  }

  private async updateProgress(params: MCPToolParams['updateProgress']) {
    await this.slackClient.updateProgress(params.message, params.threadTs);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Progress update sent to thread ${params.threadTs}`,
        },
      ],
    };
  }

  private async getResponses(params: MCPToolParams['getResponses']) {
    const session = params.sessionId 
      ? this.configManager.getSession(params.sessionId)
      : await this.sessionManager.getCurrentSession();
      
    if (!session) {
      throw new McpError(ErrorCode.InvalidParams, 'No session found');
    }

    let responses;
    
    if (session.mode === 'webhook') {
      // Get webhook responses
      responses = this.slackClient.getWebhookResponses(session.sessionId);
    } else {
      // Use polling
      responses = await this.slackClient.pollMessages(session.sessionId, params.since);
    }

    if (responses.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No new responses yet. Keep checking...',
          },
        ],
      };
    }

    const responseText = responses.map(r => 
      `[${new Date(r.timestamp).toLocaleTimeString()}] ${r.response}`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Responses received:\n\n${responseText}`,
        },
      ],
    };
  }

  private async listSessions() {
    const sessions = await this.sessionManager.getAllActiveSessions();
    
    if (sessions.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No active sessions',
          },
        ],
      };
    }

    const sessionList = sessions.map(s => 
      `• Session ${s.sessionId}\n  User: ${s.userId}\n  Channel: ${s.channelId}\n  Port: ${s.port}\n  Mode: ${s.mode}\n  Created: ${s.createdAt.toLocaleString()}`
    ).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Active sessions:\n\n${sessionList}`,
        },
      ],
    };
  }

  private async ensureSession(): Promise<void> {
    if (!this.slackClient.isConfigured()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Slack not configured. Please use setup_slack_config first.'
      );
    }

    let session = await this.sessionManager.getCurrentSession();
    
    if (!session) {
      // Detect user and create session
      const user = await this.slackClient.detectUser();
      session = await this.sessionManager.createSession(user);
      
      // Create session channel
      const channelName = this.sessionManager.getChannelName(user.username, session.sessionId);
      const channel = await this.slackClient.createChannel(channelName);
      await this.sessionManager.updateSessionChannel(session.sessionId, channel.id);
      
      // Try to setup webhook
      try {
        await this.setupWebhook(session.sessionId, session.port);
      } catch (error) {
        console.error('Failed to setup webhook, falling back to polling:', error);
        await this.sessionManager.setSessionPollingMode(session.sessionId);
      }
    }
  }

  private async setupWebhook(sessionId: string, port: number): Promise<void> {
    // Check if cloudflared is installed
    this.tunnelManager = new TunnelManager(port);
    const isInstalled = await this.tunnelManager.checkCloudflaredInstalled();
    
    if (!isInstalled) {
      throw new Error('cloudflared not installed. Install it or use polling mode.');
    }

    // Start tunnel
    const tunnelUrl = await this.tunnelManager.start();
    
    // Start webhook server
    this.webhookServer = new WebhookServer(port, sessionId, this.slackClient);
    await this.webhookServer.start();
    
    // Update session with webhook info
    const webhookUrl = `http://localhost:${port}`;
    await this.sessionManager.updateSessionWebhook(sessionId, webhookUrl, tunnelUrl);
  }

  async start(): Promise<void> {
    await this.configManager.init();
    await this.sessionManager.init();
    await this.slackClient.init();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Claude MCP Slack Feedback server started');
  }

  async cleanup(): Promise<void> {
    if (this.webhookServer?.isRunning()) {
      await this.webhookServer.stop();
    }
    if (this.tunnelManager?.isRunning()) {
      await this.tunnelManager.stop();
    }
  }
}

const server = new SlackFeedbackMCPServer();

// Handle cleanup on exit
process.on('SIGINT', async () => {
  await server.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.cleanup();
  process.exit(0);
});

server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});