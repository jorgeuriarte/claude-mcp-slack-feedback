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
        {
          name: 'get_version',
          description: 'Get MCP server version and build time',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'set_channel',
          description: 'Set the Slack channel for the current session',
          inputSchema: {
            type: 'object',
            properties: {
              channel: {
                type: 'string',
                description: 'Channel name (without #) or channel ID',
              },
            },
            required: ['channel'],
          },
        },
        {
          name: 'list_channels',
          description: 'List available Slack channels',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'set_session_label',
          description: 'Set a custom label for the current session to help identify it in Slack',
          inputSchema: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Custom label for the session (e.g., "Frontend Dev", "API Testing")',
              },
            },
            required: ['label'],
          },
        },
        {
          name: 'set_session_contact',
          description: 'Set the contact to mention in Slack messages (e.g., @jorge or @here)',
          inputSchema: {
            type: 'object',
            properties: {
              contact: {
                type: 'string',
                description: 'Slack username to mention (without @) or "here" for @here',
              },
            },
            required: ['contact'],
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
          
          case 'get_version':
            return await this.getVersion();
          
          case 'set_channel':
            return await this.setChannel(args as { channel: string });
          
          case 'list_channels':
            return await this.listChannels();
          
          case 'set_session_label':
            return await this.setSessionLabel(args as { label: string });
          
          case 'set_session_contact':
            return await this.setSessionContact(args as { contact: string });
          
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
      const { workspaceUrl, teamId } = await this.slackClient.setToken(params.botToken, params.workspaceUrl);
      
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

    // Check if channel is set for this session
    if (!session.channelId || session.channelId === '') {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ No channel selected for this session!\n\nPlease first:\n1. Use 'list_channels' to see available channels\n2. Use 'set_channel' to select a channel\n\nExample: set_channel with channel "general"`,
          },
        ],
      };
    }

    // Check if session needs configuration
    if (!session.sessionLabel || !session.sessionContact) {
      const suggestedLabel = SessionManager.extractSessionLabelFromPath();
      let configMessage = `⚠️ Session needs configuration before sending feedback:\n\n`;
      
      if (!session.sessionLabel) {
        configMessage += `📝 **Session Label**: Not set\n`;
        configMessage += `   Suggested: "${suggestedLabel}"\n`;
        configMessage += `   Use: set_session_label with label "${suggestedLabel}"\n\n`;
      }
      
      if (!session.sessionContact) {
        configMessage += `👤 **Contact**: Not set\n`;
        configMessage += `   Use: set_session_contact with contact "jorge" (or "here" for @here)\n\n`;
      }
      
      configMessage += `These settings help identify your session in Slack and notify the right people.`;
      
      return {
        content: [
          {
            type: 'text',
            text: configMessage,
          },
        ],
      };
    }

    const request: FeedbackRequest = {
      sessionId: session.sessionId,
      question: params.question,
      context: params.context,
      options: params.options,
      timestamp: Date.now()
    };

    const threadTs = await this.slackClient.sendFeedback(request);
    
    // Get channel name if we don't have it
    const channelName = session.channelName || (await this.slackClient.getChannelInfo(session.channelId)).name;
    
    let responseText = `✅ Question sent to Slack!\n\nSession: ${session.sessionId}\nChannel: #${channelName}\nThread: ${threadTs}\nMode: ${session.mode}`;
    
    if (session.mode === 'webhook' && session.tunnelUrl) {
      responseText += `\n\n🔗 Webhook URL ready for real-time responses!`;
      responseText += `\n${session.tunnelUrl}/slack/events`;
      responseText += `\n\n📋 Quick setup (one-time only):`;
      responseText += `\n1. Open: https://api.slack.com/apps (your app)`;
      responseText += `\n2. Go to "Event Subscriptions" → Enable Events`;
      responseText += `\n3. Paste URL above in "Request URL" → Wait for ✓`;
      responseText += `\n4. Add bot events: message.channels, message.groups`;
      responseText += `\n5. Save Changes`;
      responseText += `\n\n✨ Or just wait 1-2 seconds for polling (no setup needed)`;
    }
    
    responseText += `\n\nUse get_responses to retrieve the answer.`;
    
    return {
      content: [
        {
          type: 'text',
          text: responseText,
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

    // Send confirmation to Slack that responses were received
    if (responses.length > 0 && responses[0].threadTs) {
      try {
        const firstResponse = responses[0];
        const summary = firstResponse.response.substring(0, 100) + 
                       (firstResponse.response.length > 100 ? '...' : '');
        await this.slackClient.updateProgress(
          `✅ Recibido: "${summary}". Procesando...`,
          firstResponse.threadTs
        );
      } catch (error) {
        // Don't fail if confirmation fails
        console.error('Failed to send confirmation:', error);
      }
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

  private async getVersion() {
    const packageJson = {
      name: 'claude-mcp-slack-feedback',
      version: '1.3.0'
    };
    const buildTime = new Date().toISOString();
    
    return {
      content: [
        {
          type: 'text',
          text: `📦 ${packageJson.name} v${packageJson.version}\n🕐 Build time: ${buildTime}\n\n✨ Changes in v1.3.0:\n- Visual session identification with emojis and labels\n- New set_session_label tool for custom naming\n- Rich Slack blocks formatting\n- Each session has unique emoji and display name\n\n✨ v1.2.1:\n- Bot attempts to auto-join public channels\n- Better error messages when not channel member`,
        },
      ],
    };
  }

  private async setChannel(params: { channel: string }) {
    await this.ensureSession();
    
    const session = await this.sessionManager.getCurrentSession();
    if (!session) {
      throw new McpError(ErrorCode.InternalError, 'No active session');
    }

    // Handle channel name with or without #
    let channelName = params.channel.replace(/^#/, '');
    
    // Try to find the channel
    const channelId = await this.slackClient.findChannel(channelName);
    if (!channelId) {
      throw new McpError(ErrorCode.InvalidParams, `Channel #${channelName} not found`);
    }

    // Update session with channel
    await this.sessionManager.updateSessionChannel(session.sessionId, channelId);
    
    // Store channel name for display
    const channelInfo = await this.slackClient.getChannelInfo(channelId);
    await this.sessionManager.updateSession(session.sessionId, {
      channelName: channelInfo.name
    });

    // Check if bot is member
    const channels = await this.slackClient.listChannels();
    const channelDetails = channels.find(ch => ch.name === channelInfo.name);
    const isMember = channelDetails?.is_member || false;

    let message = `✅ Channel set to #${channelInfo.name}\n\nAll feedback for this session will be sent to this channel.`;
    
    if (!isMember) {
      message += `\n\n⚠️ Note: The bot may not be a member of this channel. If you can't send messages, please invite the bot to #${channelInfo.name} using:\n/invite @your-bot-name`;
    }

    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
    };
  }

  private async listChannels() {
    if (!this.slackClient.isConfigured()) {
      throw new McpError(ErrorCode.InvalidRequest, 'Slack not configured');
    }

    const channels = await this.slackClient.listChannels();
    
    if (channels.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No channels found. Make sure the bot has access to channels.',
          },
        ],
      };
    }

    const channelList = channels
      .map(ch => `• #${ch.name} ${ch.is_member ? '(bot is member)' : ''}`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Available channels:\n\n${channelList}\n\nUse 'set_channel' to select one.`,
        },
      ],
    };
  }

  private async setSessionLabel(params: { label: string }) {
    await this.ensureSession();
    
    const session = await this.sessionManager.getCurrentSession();
    if (!session) {
      throw new McpError(ErrorCode.InternalError, 'No active session');
    }

    await this.sessionManager.updateSession(session.sessionId, {
      sessionLabel: params.label
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Session label set to: "${params.label}"\n\nThis label will appear in all Slack messages from this session.`,
        },
      ],
    };
  }

  private async setSessionContact(params: { contact: string }) {
    await this.ensureSession();
    
    const session = await this.sessionManager.getCurrentSession();
    if (!session) {
      throw new McpError(ErrorCode.InternalError, 'No active session');
    }

    // Add @ prefix if not present and not "here"
    const contact = params.contact === 'here' ? '@here' : 
                   params.contact.startsWith('@') ? params.contact : `@${params.contact}`;

    await this.sessionManager.updateSession(session.sessionId, {
      sessionContact: contact
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Session contact set to: ${contact}\n\nThis contact will be mentioned in all Slack messages from this session.`,
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
      
      // Don't create a channel automatically - user must select one
      
      // Try to setup webhook with cloudflared
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