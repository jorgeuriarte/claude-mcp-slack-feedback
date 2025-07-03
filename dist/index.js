#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ConfigManager } from './config-manager.js';
import { SessionManager } from './session-manager.js';
import { SlackClient } from './slack-client.js';
import { TunnelManager } from './tunnel-manager.js';
import { WebhookServer } from './webhook-server.js';
import { PollingStrategy } from './polling-strategy.js';
import { logger } from './logger.js';
import { config } from 'dotenv';
config();
class SlackFeedbackMCPServer {
    server;
    configManager;
    sessionManager;
    slackClient;
    tunnelManager;
    webhookServer;
    constructor() {
        logger.info('Initializing MCP Server...');
        logger.setupErrorHandlers();
        this.server = new Server({
            name: 'claude-mcp-slack-feedback',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        try {
            this.configManager = new ConfigManager();
            this.sessionManager = new SessionManager(this.configManager);
            this.slackClient = new SlackClient(this.configManager, this.sessionManager);
            logger.info('MCP Server initialized successfully');
            this.setupHandlers();
        }
        catch (error) {
            logger.error('Failed to initialize MCP Server:', error);
            throw error;
        }
    }
    setupHandlers() {
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
                    name: 'send_question',
                    description: `Send a BLOCKING question that requires human input to proceed.
  
Use this when:
- You need a decision or clarification before continuing
- The task cannot proceed without human input
- You're asking for approval, confirmation, or choice between options

DO NOT use for:
- Progress updates or status reports (use inform_slack instead)
- Optional feedback that won't block your work

The tool automatically waits for responses with intelligent timeouts based on priority:
- urgent: No timeout (waits indefinitely)
- high: 30 minutes timeout
- normal: 15 minutes timeout  
- low: 5 minutes timeout

If timeout occurs, you'll receive guidance to make your best decision and continue.`,
                    inputSchema: {
                        type: 'object',
                        properties: {
                            question: {
                                type: 'string',
                                description: 'The question to ask',
                            },
                            context: {
                                type: 'string',
                                description: 'Optional context to help the human understand',
                            },
                            options: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Suggested response options',
                            },
                            priority: {
                                type: 'string',
                                enum: ['low', 'normal', 'high', 'urgent'],
                                description: 'Visual priority indicator (affects emoji and formatting)',
                            },
                            response_type: {
                                type: 'string',
                                enum: ['quick', 'detailed', 'any'],
                                description: 'quick: expect short answer in channel, detailed: expect thread response',
                            },
                        },
                        required: ['question'],
                    },
                },
                {
                    name: 'add_reaction',
                    description: `Add an emoji reaction to any message for simple acknowledgments.
  
WHEN TO USE:
- User sends instructions → React with 👀 (eyes) to show "processing"
- Task completed → React with ✅ (white_check_mark) 
- Simple acknowledgment → React with 👍 (thumbsup)
- Considering/thinking → React with 🤔 (thinking_face)

Common reactions:
- eyes (👀): Processing/seen
- white_check_mark (✅): Done/completed
- thumbsup (👍): Acknowledged
- thinking_face (🤔): Considering
- hourglass (⏳): Working on it

DO NOT use for:
- Providing information → use send_simple_update
- Complex status → use inform_slack

⚠️ IMPORTANT: Requires exact message timestamp from tool responses.`,
                    inputSchema: {
                        type: 'object',
                        properties: {
                            channel: {
                                type: 'string',
                                description: 'Channel ID (e.g., "C093FLV2MK7") - NOT the channel name. Get this from tool responses.',
                            },
                            timestamp: {
                                type: 'string',
                                description: 'Exact message timestamp from Slack (e.g., "1735823387.938429"). Must come from a tool response - cannot be guessed.',
                            },
                            reaction: {
                                type: 'string',
                                description: 'Emoji name without colons (e.g., "thumbsup", not ":thumbsup:")',
                            },
                        },
                        required: ['channel', 'timestamp', 'reaction'],
                    },
                },
                {
                    name: 'get_recent_messages',
                    description: `Get recent messages from current channel with their timestamps.
          
Use this tool when you need to:
- React to specific messages
- Reference previous messages
- Get exact message timestamps for reactions

Returns up to 10 recent messages with their channel IDs and timestamps.`,
                    inputSchema: {
                        type: 'object',
                        properties: {
                            limit: {
                                type: 'number',
                                description: 'Number of messages to retrieve (default: 10, max: 20)',
                            },
                        },
                    },
                },
                {
                    name: 'inform_slack',
                    description: `Send a structured status update for important information.
          
WHEN TO USE:
- Major task completion
- Important findings or results
- Complex status requiring structure
- Starting new major phase of work

Creates formatted message with session info and structure.

DO NOT use for:
- Simple acknowledgments → use add_reaction
- Brief updates → use send_simple_update
- Questions → use send_question

MONITORING: Has 1-minute courtesy period. If user responds, you'll see their message.`,
                    inputSchema: {
                        type: 'object',
                        properties: {
                            message: {
                                type: 'string',
                                description: 'The informational message to send',
                            },
                            context: {
                                type: 'string',
                                description: 'Optional additional context',
                            },
                        },
                        required: ['message'],
                    },
                },
                {
                    name: 'send_simple_update',
                    description: `Send a brief, unformatted status update in the thread.
          
Use this when:
- Providing quick status updates
- Confirming actions with short messages
- Adding brief information to the conversation

This sends a clean message without session labels or formatting.
Example outputs: "ℹ️ Found 3 files", "✓ Configuration saved", "→ Processing next step"

DO NOT use for:
- Simple acknowledgments (use add_reaction instead)
- Complex updates needing structure (use inform_slack)
- Questions (use send_question)`,
                    inputSchema: {
                        type: 'object',
                        properties: {
                            message: {
                                type: 'string',
                                description: 'Brief update message (recommended: < 100 chars)',
                            },
                            threadTs: {
                                type: 'string',
                                description: 'Thread timestamp to update (from previous message)',
                            },
                        },
                        required: ['message', 'threadTs'],
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
                {
                    name: 'configure_polling',
                    description: 'Configure polling behavior for the current session',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            autoStart: {
                                type: 'boolean',
                                description: 'Start polling automatically when in polling/hybrid mode',
                            },
                            initialDelay: {
                                type: 'number',
                                description: 'Initial polling delay in milliseconds (default: 2000)',
                            },
                            normalInterval: {
                                type: 'number',
                                description: 'Normal polling interval in milliseconds (default: 5000)',
                            },
                            idleInterval: {
                                type: 'number',
                                description: 'Idle polling interval in milliseconds (default: 30000)',
                            },
                            maxInterval: {
                                type: 'number',
                                description: 'Maximum polling interval in milliseconds (default: 60000)',
                            },
                        },
                    },
                },
                {
                    name: 'configure_hybrid',
                    description: 'Configure hybrid mode behavior for the current session',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            webhookTimeout: {
                                type: 'number',
                                description: 'Webhook timeout in milliseconds (default: 5000)',
                            },
                            fallbackAfterFailures: {
                                type: 'number',
                                description: 'Number of failures before switching to polling (default: 3)',
                            },
                            healthCheckInterval: {
                                type: 'number',
                                description: 'Health check interval in milliseconds (default: 300000)',
                            },
                        },
                    },
                },
                {
                    name: 'set_session_mode',
                    description: 'Set the operation mode for the current session',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            mode: {
                                type: 'string',
                                enum: ['webhook', 'polling', 'hybrid'],
                                description: 'Operation mode: webhook (instant), polling (reliable), or hybrid (best of both)',
                            },
                        },
                        required: ['mode'],
                    },
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            logger.info(`Tool called: ${name}`, { args });
            try {
                switch (name) {
                    case 'setup_slack_config':
                        return await this.setupSlackConfig(args);
                    case 'send_question':
                        return await this.sendQuestion(args);
                    case 'add_reaction':
                        return await this.addReaction(args);
                    case 'get_recent_messages':
                        return await this.getRecentMessages(args);
                    case 'inform_slack':
                        return await this.informSlack(args);
                    case 'send_simple_update':
                        return await this.sendSimpleUpdate(args);
                    case 'update_progress':
                        return await this.updateProgress(args);
                    case 'get_responses':
                        return await this.getResponses(args);
                    case 'list_sessions':
                        return await this.listSessions();
                    case 'get_version':
                        return await this.getVersion();
                    case 'set_channel':
                        return await this.setChannel(args);
                    case 'list_channels':
                        return await this.listChannels();
                    case 'set_session_label':
                        return await this.setSessionLabel(args);
                    case 'set_session_contact':
                        return await this.setSessionContact(args);
                    case 'configure_polling':
                        return await this.configurePolling(args);
                    case 'configure_hybrid':
                        return await this.configureHybrid(args);
                    case 'set_session_mode':
                        return await this.setSessionMode(args);
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                logger.error(`Tool ${name} failed:`, error);
                if (error instanceof McpError) {
                    throw error;
                }
                throw new McpError(ErrorCode.InternalError, `Tool ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    async setupSlackConfig(params) {
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
        }
        catch (error) {
            throw new McpError(ErrorCode.InvalidParams, `Failed to configure Slack: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async sendQuestion(params) {
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
                        text: `⚠️ No channel selected for this session!\n\nPlease first:\n1. Use 'list_channels' to see available channels\n2. Use 'set_channel' to select a channel`,
                    },
                ],
            };
        }
        // Check if session needs configuration
        if (!session.sessionLabel || !session.sessionContact) {
            const suggestedLabel = SessionManager.extractSessionLabelFromPath();
            let configMessage = `⚠️ Session needs configuration before sending questions:\n\n`;
            if (!session.sessionLabel) {
                configMessage += `📝 **Session Label**: Not set\n`;
                configMessage += `   Suggested: "${suggestedLabel}"\n`;
                configMessage += `   Use: set_session_label with label "${suggestedLabel}"\n\n`;
            }
            if (!session.sessionContact) {
                configMessage += `👤 **Contact**: Not set\n`;
                configMessage += `   Use: set_session_contact with contact "juriarte" (or "here" for @here)\n\n`;
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: configMessage,
                    },
                ],
            };
        }
        // Define timeouts based on priority
        const timeouts = {
            urgent: 0, // No timeout - wait indefinitely
            high: 30 * 60, // 30 minutes
            normal: 15 * 60, // 15 minutes
            low: 5 * 60 // 5 minutes
        };
        // Create request with priority indicators
        const priorityEmojis = {
            low: '🟢',
            normal: '🔵',
            high: '🟡',
            urgent: '🔴'
        };
        const priority = params.priority || 'normal';
        const emoji = priorityEmojis[priority];
        const timeout = timeouts[priority];
        const request = {
            sessionId: session.sessionId,
            question: params.question,
            context: params.context,
            options: params.options,
            timestamp: Date.now()
        };
        // Add enhanced request formatting
        const enhancedRequest = {
            ...request,
            priority: params.priority
        };
        const threadTs = await this.slackClient.sendFeedback(enhancedRequest);
        // Get channel name
        const channelName = session.channelName || (await this.slackClient.getChannelInfo(session.channelId)).name;
        let statusText = `✅ Question sent to Slack!\n\nChannel: #${channelName}\nPriority: ${priority} ${emoji}\nMode: ${session.mode}`;
        if (timeout > 0) {
            statusText += `\nTimeout: ${timeout / 60} minutes`;
        }
        else {
            statusText += `\nTimeout: None (waiting indefinitely)`;
        }
        statusText += `\n\n⏳ Waiting for response...`;
        // Start polling with timeout
        const useCloudPolling = process.env.CLOUD_FUNCTION_URL ? true : false;
        const pollingStrategy = useCloudPolling
            ? PollingStrategy.createCloudPolling(this.slackClient, session.sessionId, 'feedback-required')
            : PollingStrategy.createFeedbackRequired(this.slackClient, session.sessionId);
        const result = await pollingStrategy.executeWithTimeout(threadTs, timeout);
        if (result.timedOut) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `${statusText}\n\n⏰ **Timeout reached** - No response received within ${timeout / 60} minutes.\n\n**You (the LLM) should:**\n- Make your best decision based on context and available information\n- Inform the user of your decision with 'inform_slack'\n- Continue with the task\n\n**Original question:** ${params.question}\n**Suggested options:** ${params.options?.join(', ') || 'None provided'}`,
                    },
                ],
            };
        }
        if (result.responses.length > 0) {
            const responseText = result.responses.map(r => `[${new Date(r.timestamp).toLocaleTimeString()}] <@${r.userId}>: ${r.response}`).join('\n');
            // Send confirmation to Slack
            try {
                const firstResponse = result.responses[0];
                const summary = firstResponse.response.substring(0, 100) +
                    (firstResponse.response.length > 100 ? '...' : '');
                await this.slackClient.updateProgress(`✅ Received: "${summary}". Processing...`, threadTs);
            }
            catch (error) {
                logger.error('Failed to send confirmation:', error);
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `${statusText}\n\n💬 **Response received:**\n${responseText}`,
                    },
                ],
            };
        }
        // Should not reach here, but just in case
        return {
            content: [
                {
                    type: 'text',
                    text: `${statusText}\n\n❌ Unexpected result: no timeout and no responses.`,
                },
            ],
        };
    }
    async informSlack(params) {
        await this.ensureSession();
        const session = await this.sessionManager.getCurrentSession();
        if (!session) {
            throw new McpError(ErrorCode.InternalError, 'No active session');
        }
        // Check if channel is set
        if (!session.channelId || session.channelId === '') {
            return {
                content: [
                    {
                        type: 'text',
                        text: `⚠️ No channel selected! Use 'set_channel' first.`,
                    },
                ],
            };
        }
        // Send informational message with clear visual distinction
        const threadTs = await this.slackClient.sendStatusUpdate(params.message, params.context);
        // Get channel name
        const channelName = session.channelName || (await this.slackClient.getChannelInfo(session.channelId)).name;
        let statusText = `✅ Information sent to Slack!\n\nChannel: #${channelName}\nThread: ${threadTs}`;
        // Start courtesy polling
        const pollingStrategy = PollingStrategy.createCourtesyInform(this.slackClient, session.sessionId);
        const result = await pollingStrategy.execute(threadTs);
        if (result.responses.length > 0) {
            const responseText = result.responses.map(r => `[${new Date(r.timestamp).toLocaleTimeString()}] <@${r.userId}>: ${r.response}`).join('\n');
            return {
                content: [
                    {
                        type: 'text',
                        text: `${statusText}\n\n💬 User response received during monitoring period:\n${responseText}\n\n` +
                            `**IMPORTANT**: You (the LLM) must analyze this response and decide:\n` +
                            `- If it's a simple acknowledgment → Continue with your tasks\n` +
                            `- If it expresses concern/cancellation (like "NOOO", "wait", "stop") → Use 'send_question' to clarify what the user wants\n` +
                            `- If it provides new instructions → Adjust your approach accordingly\n\n` +
                            `The user's message context and tone are more important than specific keywords.`,
                    },
                ],
            };
        }
        // No response after courtesy polling - continue with work
        return {
            content: [
                {
                    type: 'text',
                    text: `${statusText}\n\n✅ No response received. Continuing with tasks.`,
                },
            ],
        };
    }
    async sendSimpleUpdate(params) {
        await this.ensureSession();
        const session = await this.sessionManager.getCurrentSession();
        if (!session || !session.channelId) {
            throw new McpError(ErrorCode.InvalidRequest, 'No active session or channel. Use set_channel first.');
        }
        try {
            // Send simple message to thread without formatting
            await this.slackClient.sendSimpleThreadMessage(session.channelId, params.message, params.threadTs);
            return {
                content: [
                    {
                        type: 'text',
                        text: `✓ Update sent`,
                    },
                ],
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Failed to send update: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async updateProgress(params) {
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
    async getRecentMessages(params) {
        await this.ensureSession();
        const session = await this.sessionManager.getCurrentSession();
        if (!session || !session.channelId) {
            throw new McpError(ErrorCode.InvalidRequest, 'No active session or channel. Use set_channel first.');
        }
        const limit = Math.min(params.limit || 10, 20);
        try {
            const messages = await this.slackClient.getRecentMessages(session.channelId, limit);
            const formattedMessages = messages.map((msg, index) => `${index + 1}. ${msg.user}: ${msg.text?.substring(0, 50)}...\n   Channel: ${session.channelId}\n   Timestamp: ${msg.ts}`).join('\n\n');
            return {
                content: [
                    {
                        type: 'text',
                        text: `Recent messages in channel:\n\n${formattedMessages}\n\nUse these exact channel IDs and timestamps with the add_reaction tool.`,
                    },
                ],
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InternalError, `Failed to get messages: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async addReaction(params) {
        try {
            // Ensure we have a client
            if (!this.slackClient.hasValidToken()) {
                throw new McpError(ErrorCode.InvalidRequest, 'Slack not configured. Use setup_slack_config first.');
            }
            // Add the reaction using the Slack Web API
            await this.slackClient.addReaction(params.channel, params.timestamp, params.reaction);
            return {
                content: [
                    {
                        type: 'text',
                        text: `✅ Added :${params.reaction}: reaction to message`,
                    },
                ],
            };
        }
        catch (error) {
            // Handle specific Slack errors
            if (error instanceof Error) {
                if (error.message.includes('already_reacted')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `ℹ️ Already reacted with :${params.reaction}: to this message`,
                            },
                        ],
                    };
                }
                else if (error.message.includes('invalid_name')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `❌ Invalid reaction name: ${params.reaction}\n\nUse emoji names without colons, e.g., "thumbsup" not ":thumbsup:"`,
                            },
                        ],
                    };
                }
                else if (error.message.includes('message_not_found')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `❌ Message not found\n\nThe timestamp "${params.timestamp}" doesn't match any message in channel ${params.channel}.\n\nTip: Use 'get_recent_messages' to get valid message timestamps.`,
                            },
                        ],
                    };
                }
                else if (error.message.includes('channel_not_found')) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `❌ Channel not found\n\nThe channel ID "${params.channel}" is invalid.\n\nTip: Use 'get_recent_messages' to get the correct channel ID.`,
                            },
                        ],
                    };
                }
            }
            throw error;
        }
    }
    async getResponses(params) {
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
        }
        else {
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
                await this.slackClient.updateProgress(`✅ Recibido: "${summary}". Procesando...`, firstResponse.threadTs);
            }
            catch (error) {
                // Don't fail if confirmation fails
                logger.error('Failed to send confirmation:', error);
            }
        }
        const responseText = responses.map(r => `[${new Date(r.timestamp).toLocaleTimeString()}] ${r.response}`).join('\n');
        return {
            content: [
                {
                    type: 'text',
                    text: `Responses received:\n\n${responseText}`,
                },
            ],
        };
    }
    async listSessions() {
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
        const sessionList = sessions.map(s => `• Session ${s.sessionId}\n  User: ${s.userId}\n  Channel: ${s.channelId}\n  Port: ${s.port}\n  Mode: ${s.mode}\n  Created: ${s.createdAt.toLocaleString()}`).join('\n\n');
        return {
            content: [
                {
                    type: 'text',
                    text: `Active sessions:\n\n${sessionList}`,
                },
            ],
        };
    }
    async getVersion() {
        const packageJson = {
            name: 'claude-mcp-slack-feedback',
            version: '1.3.1'
        };
        const buildTime = new Date().toISOString();
        return {
            content: [
                {
                    type: 'text',
                    text: `📦 ${packageJson.name} v${packageJson.version}\n🕐 Build time: ${buildTime}\n\n✨ Changes in v1.3.1:\n- cloudflared is now optional (defaults to polling mode)\n- Automatic detection of cloudflared availability\n- Improved fallback to polling when webhook setup fails\n\n✨ v1.3.0:\n- Visual session identification with emojis and labels\n- New set_session_label tool for custom naming\n- Rich Slack blocks formatting\n\n✨ v1.2.1:\n- Bot attempts to auto-join public channels\n- Better error messages when not channel member`,
                },
            ],
        };
    }
    async setChannel(params) {
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
    async listChannels() {
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
    async setSessionLabel(params) {
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
    async setSessionContact(params) {
        await this.ensureSession();
        const session = await this.sessionManager.getCurrentSession();
        if (!session) {
            throw new McpError(ErrorCode.InternalError, 'No active session');
        }
        // Store contact without @ prefix for Slack formatting
        const contact = params.contact.replace(/^@/, '');
        await this.sessionManager.updateSession(session.sessionId, {
            sessionContact: contact
        });
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Session contact set to: @${contact}\n\nThis contact will be mentioned in all Slack messages from this session.`,
                },
            ],
        };
    }
    async configurePolling(params) {
        await this.ensureSession();
        const session = await this.sessionManager.getCurrentSession();
        if (!session) {
            throw new McpError(ErrorCode.InternalError, 'No active session');
        }
        // Validate parameters
        if (params.initialDelay && params.initialDelay < 100) {
            throw new McpError(ErrorCode.InvalidParams, 'Initial delay must be at least 100ms');
        }
        if (params.normalInterval && params.normalInterval < 1000) {
            throw new McpError(ErrorCode.InvalidParams, 'Normal interval must be at least 1000ms');
        }
        // Update polling config
        const updatedConfig = {
            ...session.pollingConfig,
            ...params
        };
        await this.sessionManager.updateSession(session.sessionId, {
            pollingConfig: updatedConfig
        });
        // If polling is active, restart with new config
        const pollingManager = this.sessionManager.getPollingManager(session.sessionId);
        if (pollingManager && pollingManager.isActive()) {
            this.sessionManager.stopPolling(session.sessionId);
            // Will be restarted with new config on next feedback request
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Polling configuration updated:\n\n${JSON.stringify(updatedConfig, null, 2)}`,
                },
            ],
        };
    }
    async configureHybrid(params) {
        await this.ensureSession();
        const session = await this.sessionManager.getCurrentSession();
        if (!session) {
            throw new McpError(ErrorCode.InternalError, 'No active session');
        }
        // Validate parameters
        if (params.webhookTimeout && params.webhookTimeout < 1000) {
            throw new McpError(ErrorCode.InvalidParams, 'Webhook timeout must be at least 1000ms');
        }
        if (params.fallbackAfterFailures && params.fallbackAfterFailures < 1) {
            throw new McpError(ErrorCode.InvalidParams, 'Fallback failures must be at least 1');
        }
        if (params.healthCheckInterval && params.healthCheckInterval < 30000) {
            throw new McpError(ErrorCode.InvalidParams, 'Health check interval must be at least 30000ms');
        }
        // Update hybrid config
        const updatedConfig = {
            ...session.hybridConfig,
            ...params
        };
        await this.sessionManager.updateSession(session.sessionId, {
            hybridConfig: updatedConfig
        });
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Hybrid mode configuration updated:\n\n${JSON.stringify(updatedConfig, null, 2)}`,
                },
            ],
        };
    }
    async setSessionMode(params) {
        await this.ensureSession();
        const session = await this.sessionManager.getCurrentSession();
        if (!session) {
            throw new McpError(ErrorCode.InternalError, 'No active session');
        }
        const oldMode = session.mode;
        // Check if webhook is available for webhook/hybrid modes
        if ((params.mode === 'webhook' || params.mode === 'hybrid') && !session.tunnelUrl) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `⚠️ Cannot set mode to ${params.mode} - webhook not configured.\n\nThe session is currently in ${oldMode} mode.`,
                    },
                ],
            };
        }
        await this.sessionManager.setSessionMode(session.sessionId, params.mode);
        // Update health monitoring based on new mode
        if (params.mode === 'hybrid' && this.webhookServer) {
            this.sessionManager.startHealthMonitoring(session.sessionId, this.webhookServer);
        }
        else {
            this.sessionManager.stopHealthMonitoring(session.sessionId);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Session mode changed from ${oldMode} to ${params.mode}\n\n${params.mode === 'webhook' ? '⚡ Using webhook for instant responses' :
                        params.mode === 'polling' ? '🔄 Using polling for reliable responses' :
                            '🔀 Using hybrid mode with webhook + polling backup'}`,
                },
            ],
        };
    }
    async ensureSession() {
        try {
            if (!this.slackClient.isConfigured()) {
                throw new McpError(ErrorCode.InvalidRequest, 'Slack not configured. Please use setup_slack_config first.');
            }
            let session = await this.sessionManager.getCurrentSession();
            if (!session) {
                // Detect user and create session
                const user = await this.slackClient.detectUser();
                session = await this.sessionManager.createSession(user);
                // Don't create a channel automatically - user must select one
                // Default to polling mode unless cloudflared is available
                const cloudflaredAvailable = await TunnelManager.isAvailable();
                if (cloudflaredAvailable) {
                    // Try to setup webhook with cloudflared
                    try {
                        await this.setupWebhook(session.sessionId, session.port);
                        await this.sessionManager.setSessionMode(session.sessionId, 'hybrid');
                        // Start health monitoring for hybrid mode
                        this.sessionManager.startHealthMonitoring(session.sessionId, this.webhookServer);
                        logger.info(`Session ${session.sessionId}: Hybrid mode enabled (webhook + polling backup with health monitoring)`);
                    }
                    catch (error) {
                        logger.error('Failed to setup webhook, falling back to polling:', error);
                        await this.sessionManager.setSessionMode(session.sessionId, 'polling');
                        logger.info(`Session ${session.sessionId}: Using polling mode (webhook setup failed)`);
                    }
                }
                else {
                    // cloudflared not available, use polling mode
                    await this.sessionManager.setSessionMode(session.sessionId, 'polling');
                    logger.info(`Session ${session.sessionId}: Using polling mode (cloudflared not available)`);
                }
            }
        }
        catch (error) {
            logger.error('Error in ensureSession:', error);
            throw error;
        }
    }
    async setupWebhook(sessionId, port) {
        // Initialize tunnel manager
        this.tunnelManager = new TunnelManager(port);
        // Start tunnel (will throw if cloudflared not available)
        const tunnelUrl = await this.tunnelManager.start();
        // Start webhook server
        this.webhookServer = new WebhookServer(port, sessionId, this.slackClient);
        await this.webhookServer.start();
        // Update session with webhook info
        const webhookUrl = `http://localhost:${port}`;
        await this.sessionManager.updateSessionWebhook(sessionId, webhookUrl, tunnelUrl);
    }
    async start() {
        try {
            logger.info('Starting MCP server...');
            await this.configManager.init();
            await this.sessionManager.init();
            await this.slackClient.init();
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            logger.info('Claude MCP Slack Feedback server started successfully');
        }
        catch (error) {
            logger.error('Error starting MCP server:', error);
            throw error;
        }
    }
    async cleanup() {
        try {
            logger.info('Cleaning up resources...');
            if (this.webhookServer?.isRunning()) {
                await this.webhookServer.stop();
            }
            if (this.tunnelManager?.isRunning()) {
                await this.tunnelManager.stop();
            }
            logger.close();
        }
        catch (error) {
            logger.error('Error during cleanup:', error);
        }
    }
}
const server = new SlackFeedbackMCPServer();
// Handle cleanup on exit
process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    await server.cleanup();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    await server.cleanup();
    process.exit(0);
});
server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map