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
import { MCPToolParams } from './types.js';
import { config } from 'dotenv';

config();

class SlackFeedbackMCPServer {
  private server: Server;
  private configManager: ConfigManager;
  private sessionManager: SessionManager;

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

  private async setupSlackConfig(_params: MCPToolParams['setupSlackConfig']) {
    // TODO: Implement Slack configuration
    // This will be implemented when we add the Slack client
    return {
      content: [
        {
          type: 'text',
          text: 'Slack configuration saved. This feature will be fully implemented with Slack client integration.',
        },
      ],
    };
  }

  private async askFeedback(params: MCPToolParams['askFeedback']) {
    // TODO: Implement feedback request
    // This will be implemented when we add the Slack client
    return {
      content: [
        {
          type: 'text',
          text: `Question sent: "${params.question}". This feature will be fully implemented with Slack client integration.`,
        },
      ],
    };
  }

  private async updateProgress(_params: MCPToolParams['updateProgress']) {
    // TODO: Implement progress update
    // This will be implemented when we add the Slack client
    return {
      content: [
        {
          type: 'text',
          text: `Progress updated: "${_params.message}". This feature will be fully implemented with Slack client integration.`,
        },
      ],
    };
  }

  private async getResponses(_params: MCPToolParams['getResponses']) {
    // TODO: Implement response retrieval
    // This will be implemented when we add webhook/polling
    return {
      content: [
        {
          type: 'text',
          text: 'No responses yet. This feature will be fully implemented with webhook/polling integration.',
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
      `- Session ${s.sessionId}: User ${s.userId}, Channel ${s.channelId}, Mode: ${s.mode}`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Active sessions:\n${sessionList}`,
        },
      ],
    };
  }

  async start(): Promise<void> {
    await this.configManager.init();
    await this.sessionManager.init();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Claude MCP Slack Feedback server started');
  }
}

const server = new SlackFeedbackMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});