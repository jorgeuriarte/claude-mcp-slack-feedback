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
        this.server = new Server({
            name: 'claude-mcp-slack-feedback',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.configManager = new ConfigManager();
        this.sessionManager = new SessionManager(this.configManager);
        this.slackClient = new SlackClient(this.configManager, this.sessionManager);
        this.setupHandlers();
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
                    name: 'ask_feedback',
                    description: 'Send a question to Slack for human feedback (waits for response)',
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
                    name: 'inform_slack',
                    description: 'Send an informational message to Slack (no response required)',
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
            try {
                switch (name) {
                    case 'setup_slack_config':
                        return await this.setupSlackConfig(args);
                    case 'ask_feedback':
                        return await this.askFeedback(args);
                    case 'inform_slack':
                        return await this.informSlack(args);
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
    async askFeedback(params) {
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
        const request = {
            sessionId: session.sessionId,
            question: params.question,
            context: params.context,
            options: params.options,
            timestamp: Date.now()
        };
        const threadTs = await this.slackClient.sendFeedback(request);
        // Get channel name if we don't have it
        const channelName = session.channelName || (await this.slackClient.getChannelInfo(session.channelId)).name;
        let statusText = `✅ Question sent to Slack!\n\nSession: ${session.sessionId}\nChannel: #${channelName}\nThread: ${threadTs}\nMode: ${session.mode}`;
        // For webhook mode, add configuration info
        if (session.mode === 'webhook' && session.tunnelUrl) {
            statusText += `\n\n🔗 Webhook configured: ${session.tunnelUrl}/slack/events`;
        }
        else if (session.mode === 'polling') {
            statusText += `\n\n🔄 Using polling mode (checking for responses every few seconds)`;
        }
        statusText += `\n\n⏳ Waiting for response...`;
        console.log(`[askFeedback] Starting feedback collection for session ${session.sessionId} in ${session.mode} mode`);
        // Hybrid mode implementation
        if (session.mode === 'hybrid' && session.tunnelUrl) {
            // Set up both webhook and polling strategies
            const pollingStrategy = PollingStrategy.createFeedbackRequired(this.slackClient, session.sessionId);
            const webhookTimeout = session.hybridConfig?.webhookTimeout || 5000;
            // Create a promise that resolves when webhook receives a response
            const webhookPromise = new Promise((resolve) => {
                // Store resolver for webhook callback
                this.webhookServer?.setFeedbackResolver(session.sessionId, threadTs, resolve);
                // Timeout for webhook
                setTimeout(() => {
                    this.webhookServer?.clearFeedbackResolver(session.sessionId, threadTs);
                    resolve(null); // Timeout reached
                }, webhookTimeout);
            });
            // Start polling after a short delay
            const pollingPromise = new Promise(async (resolve) => {
                await new Promise(resolve => setTimeout(resolve, webhookTimeout / 2)); // Wait half the webhook timeout
                const result = await pollingStrategy.execute(threadTs);
                resolve(result);
            });
            // Race between webhook and polling
            console.log(`[askFeedback] Hybrid mode: racing webhook (${webhookTimeout}ms timeout) vs polling`);
            const winner = await Promise.race([
                webhookPromise.then(r => r ? { source: 'webhook', result: r } : null),
                pollingPromise.then(r => ({ source: 'polling', result: r }))
            ]);
            // Clean up webhook resolver if still pending
            this.webhookServer?.clearFeedbackResolver(session.sessionId, threadTs);
            if (winner && winner.source === 'webhook') {
                console.log(`[askFeedback] Webhook responded first`);
                const result = winner.result;
                // Record success for health monitoring
                this.sessionManager.recordWebhookSuccess(session.sessionId);
                // Record activity for polling manager
                this.sessionManager.recordPollingActivity(session.sessionId);
                // Return webhook response format (adapt as needed)
                return {
                    content: [
                        {
                            type: 'text',
                            text: `✅ Feedback received via webhook!\n\n${result.response}`,
                        },
                    ],
                };
            }
            else {
                // Webhook failed or timed out
                if (!winner || winner.source === 'polling') {
                    this.sessionManager.recordWebhookFailure(session.sessionId);
                }
                console.log(`[askFeedback] Polling completed (webhook ${winner ? 'timed out' : 'not available'})`);
                const result = winner?.result || await pollingStrategy.execute(threadTs);
                if (result.shouldStop) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: '❌ Feedback collection interrupted.',
                            },
                        ],
                    };
                }
                // Format responses
                const responseText = result.responses.map((r) => `[${new Date(r.timestamp).toLocaleTimeString()}] <@${r.userId}>: ${r.response}`).join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `✅ Feedback received${session.mode === 'hybrid' ? ' (via polling)' : ''}:\n\n${responseText}`,
                        },
                    ],
                };
            }
        }
        else {
            // Standard polling mode
            const pollingStrategy = PollingStrategy.createFeedbackRequired(this.slackClient, session.sessionId);
            const result = await pollingStrategy.execute(threadTs);
            console.log(`[askFeedback] Polling completed with ${result.responses.length} responses`);
            if (result.shouldStop) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: '❌ Feedback collection interrupted.',
                        },
                    ],
                };
            }
            // Format responses
            const responseText = result.responses.map(r => `[${new Date(r.timestamp).toLocaleTimeString()}] <@${r.userId}>: ${r.response}`).join('\n');
            // Send confirmation
            if (result.responses.length > 0 && result.responses[0].threadTs) {
                try {
                    const firstResponse = result.responses[0];
                    const summary = firstResponse.response.substring(0, 100) +
                        (firstResponse.response.length > 100 ? '...' : '');
                    await this.slackClient.updateProgress(`✅ Recibido: "${summary}". Procesando...`, firstResponse.threadTs);
                }
                catch (error) {
                    console.error('Failed to send confirmation:', error);
                }
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `${statusText}\n\n💬 Responses received:\n${responseText}`,
                    },
                ],
            };
        }
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
        // Send informational message
        const request = {
            sessionId: session.sessionId,
            question: `ℹ️ ${params.message}`,
            context: params.context,
            timestamp: Date.now()
        };
        const threadTs = await this.slackClient.sendFeedback(request);
        // Get channel name
        const channelName = session.channelName || (await this.slackClient.getChannelInfo(session.channelId)).name;
        let statusText = `✅ Information sent to Slack!\n\nChannel: #${channelName}\nThread: ${threadTs}`;
        // Start courtesy polling
        const pollingStrategy = PollingStrategy.createCourtesyInform(this.slackClient, session.sessionId);
        const result = await pollingStrategy.execute(threadTs);
        if (result.requiresFeedback) {
            // User sent a negative response, switch to feedback mode
            const feedbackText = result.responses.map(r => r.response).join(', ');
            return {
                content: [
                    {
                        type: 'text',
                        text: `${statusText}\n\n⚠️ User response indicates they want to provide feedback: "${feedbackText}"\n\nPlease use 'ask_feedback' to understand their concerns.`,
                    },
                ],
            };
        }
        if (result.responses.length > 0) {
            const responseText = result.responses.map(r => `[${new Date(r.timestamp).toLocaleTimeString()}] <@${r.userId}>: ${r.response}`).join('\n');
            return {
                content: [
                    {
                        type: 'text',
                        text: `${statusText}\n\n💬 Acknowledgment received:\n${responseText}`,
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
                console.error('Failed to send confirmation:', error);
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
                    console.log(`[Session ${session.sessionId}] Hybrid mode enabled (webhook + polling backup with health monitoring)`);
                }
                catch (error) {
                    console.error('Failed to setup webhook, falling back to polling:', error);
                    await this.sessionManager.setSessionMode(session.sessionId, 'polling');
                    console.log(`[Session ${session.sessionId}] Using polling mode (webhook setup failed)`);
                }
            }
            else {
                // cloudflared not available, use polling mode
                await this.sessionManager.setSessionMode(session.sessionId, 'polling');
                console.log(`[Session ${session.sessionId}] Using polling mode (cloudflared not available)`);
            }
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
        await this.configManager.init();
        await this.sessionManager.init();
        await this.slackClient.init();
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Claude MCP Slack Feedback server started');
    }
    async cleanup() {
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
//# sourceMappingURL=index.js.map