import { WebClient } from '@slack/web-api';
import { ConfigManager } from './config-manager.js';
import { SessionManager } from './session-manager.js';
import { FeedbackRequest, FeedbackResponse, UserConfig } from './types.js';
import { logger } from './logger.js';

export class SlackClient {
  private client?: WebClient;
  private configManager: ConfigManager;
  private sessionManager: SessionManager;
  private responseQueue: Map<string, FeedbackResponse[]> = new Map();
  private rateLimitRetries = 3;
  private rateLimitDelay = 1000;
  private lastMessageTs: Map<string, string> = new Map(); // Track last message timestamp per session
  private sessionThreadTs: Map<string, string> = new Map(); // Track thread timestamp per session

  constructor(configManager: ConfigManager, sessionManager: SessionManager) {
    this.configManager = configManager;
    this.sessionManager = sessionManager;
  }

  async init(): Promise<void> {
    const config = this.configManager.getSlackConfig();
    if (config) {
      this.client = new WebClient(config.botToken);
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  async setToken(botToken: string, workspaceUrl: string): Promise<{ workspaceUrl: string; teamId: string }> {
    this.client = new WebClient(botToken);
    
    // Test the token and get workspace info
    const auth = await this.retryWithBackoff(() => this.client!.auth.test());
    if (!auth.ok) {
      throw new Error('Invalid bot token');
    }

    const teamId = auth.team_id!;

    await this.configManager.setSlackConfig({
      botToken,
      workspaceUrl,
      teamId
    });

    return { workspaceUrl, teamId };
  }

  async detectUser(): Promise<UserConfig> {
    if (!this.client) {
      throw new Error('Slack client not configured');
    }

    // Get current user from environment
    const username = process.env.USER || process.env.USERNAME;
    const email = process.env.CLAUDE_USER_EMAIL;

    let user = this.configManager.getUser(email, username);
    
    if (!user) {
      // Try to find user by email or username
      let userId: string | undefined;
      
      if (email) {
        const result = await this.retryWithBackoff(() =>
          this.client!.users.lookupByEmail({ email })
        );
        userId = result.user?.id;
      } else if (username) {
        // Search for user by name
        const users = await this.retryWithBackoff(() =>
          this.client!.users.list({})
        );
        const found = users.members?.find(u => 
          u.name === username || u.real_name?.toLowerCase().includes(username.toLowerCase())
        );
        userId = found?.id;
      }

      if (!userId) {
        throw new Error('Could not detect user. Set CLAUDE_USER_EMAIL environment variable.');
      }

      // Create main channel for user
      const mainChannelName = this.sessionManager.getMainChannelName(username || 'user');
      const channel = await this.createChannel(mainChannelName);

      user = {
        userId,
        username: username || 'user',
        email,
        mainChannelId: channel.id
      };

      await this.configManager.addUser(user);
    }

    return user;
  }

  async createChannel(name: string): Promise<{ id: string; name: string }> {
    if (!this.client) {
      throw new Error('Slack client not configured');
    }

    try {
      const result = await this.retryWithBackoff(() =>
        this.client!.conversations.create({
          name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          is_private: false
        })
      );

      return {
        id: result.channel!.id!,
        name: result.channel!.name!
      };
    } catch (error: any) {
      if (error.error === 'name_taken') {
        // Channel already exists, find it
        const list = await this.retryWithBackoff(() =>
          this.client!.conversations.list()
        );
        const existing = list.channels?.find(c => c.name === name.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
        if (existing) {
          return { id: existing.id!, name: existing.name! };
        }
      }
      throw error;
    }
  }

  async sendFeedback(request: FeedbackRequest): Promise<string> {
    if (!this.client) {
      throw new Error('Slack client not configured');
    }

    const session = await this.sessionManager.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }

    // Get session emoji
    const sessionEmoji = this.getSessionEmoji(session.sessionId);
    
    // Determine priority and visual indicators
    const priority = (request as any).priority || 'normal';
    const questionType = priority === 'urgent' ? '🚨 **URGENT DECISION NEEDED**' : 
                        priority === 'high' ? '⚠️ **Important Question**' :
                        priority === 'low' ? '💭 Quick question' :
                        '❓ **Question**';
    
    // Simple, natural format
    let message = request.question;
    
    if (request.context) {
      message += `\n\n**Context:**\n${request.context}`;
    }

    if (request.options && request.options.length > 0) {
      message += '\n\n**Suggested responses:**\n';
      request.options.forEach((opt, i) => {
        message += `${i + 1}. ${opt}\n`;
      });
    }

    message += '\n\n_Please reply in this thread_';

    // Simple format - just label and message
    let formattedMessage = request.question;
    
    // Add mention at the beginning of the message
    if (session.sessionContact) {
      // Handle special case for @here
      const mention = session.sessionContact === 'here' ? '@here' : `<@${session.sessionContact}>`;
      formattedMessage = `${mention} ${formattedMessage}`;
    }
    
    const blocks: any[] = [];
    
    // Add session label and question type as context
    const contextElements = [];
    if (session.sessionLabel) {
      contextElements.push({
        type: "mrkdwn",
        text: `${sessionEmoji} ${session.sessionLabel}`
      });
    }
    contextElements.push({
      type: "mrkdwn", 
      text: questionType
    });
    
    if (contextElements.length > 0) {
      blocks.push({
        type: "context",
        elements: contextElements
      });
    }
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: formattedMessage
      }
    });

    if (request.context) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Context:*\n${request.context}`
        }
      });
    }

    if (request.options && request.options.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Suggested responses:*\n${request.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`
        }
      });
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_Please reply in this thread_"
        }
      ]
    });

    const result = await this.retryWithBackoff(() =>
      this.client!.chat.postMessage({
        channel: session.channelId,
        text: message, // Fallback text
        blocks,
        username: `Claude Session ${session.sessionId}`,
        icon_emoji: sessionEmoji
      })
    );

    // Store the message timestamp for this session
    this.lastMessageTs.set(session.sessionId, result.ts!);
    this.sessionThreadTs.set(session.sessionId, result.ts!);

    return result.ts!;
  }

  private getSessionEmoji(sessionId: string): string {
    // Generate consistent emoji based on session ID
    const emojis = ['🤖', '🎭', '🎨', '🎯', '🎪', '🎭', '🎨', '🎯', '🎪', '🎲'];
    const index = sessionId.charCodeAt(0) % emojis.length;
    return emojis[index];
  }


  async updateProgress(message: string, threadTs: string): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not configured');
    }

    const session = await this.sessionManager.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }

    const sessionEmoji = this.getSessionEmoji(session.sessionId);
    const sessionDisplay = session.sessionLabel ? 
      `${session.sessionLabel} (${session.sessionId})` : 
      session.sessionId;

    // Format with session label
    let progressText = `[${sessionDisplay}]\n${sessionEmoji} *Progress Update:*\n${message}`;

    await this.retryWithBackoff(() =>
      this.client!.chat.postMessage({
        channel: session.channelId,
        text: progressText,
        thread_ts: threadTs,
        mrkdwn: true,
        username: `Claude Session ${sessionDisplay}`,
        icon_emoji: sessionEmoji
      })
    );
  }

  async pollMessages(sessionId: string, since?: number): Promise<FeedbackResponse[]> {
    if (!this.client) {
      throw new Error('Slack client not configured');
    }

    const session = this.configManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    logger.debug(`[SlackClient] Polling messages for session ${sessionId}, channel ${session.channelId}, since ${since ? new Date(since).toLocaleTimeString() : 'beginning'}`);

    const responses: FeedbackResponse[] = [];
    const botUserId = (await this.client.auth.test()).user_id;
    
    // Get the last message timestamp for this session
    const lastMessageTs = this.lastMessageTs.get(sessionId);
    
    if (!lastMessageTs) {
      // If no message has been sent yet, check channel history
      const oldest = since ? (since / 1000).toString() : '0';
      const history = await this.retryWithBackoff(() =>
        this.client!.conversations.history({
          channel: session.channelId,
          oldest,
          limit: 100
        })
      );

      for (const msg of history.messages || []) {
        if (msg.user && msg.user !== botUserId && !msg.bot_id) {
          responses.push({
            sessionId,
            response: msg.text || '',
            timestamp: parseFloat(msg.ts!) * 1000,
            userId: msg.user,
            threadTs: msg.thread_ts || msg.ts!
          });
        }
      }
    } else {
      // Check for thread replies to our last message
      try {
        logger.debug(`[SlackClient] Checking thread replies for message ${lastMessageTs}`);
        const replies = await this.retryWithBackoff(() =>
          this.client!.conversations.replies({
            channel: session.channelId,
            ts: lastMessageTs,
            limit: 100
          })
        );

        // Skip the first message (which is our question)
        const threadMessages = replies.messages?.slice(1) || [];
        logger.debug(`[SlackClient] Found ${threadMessages.length} messages in thread`);
        
        for (const msg of threadMessages) {
          if (msg.user && msg.user !== botUserId && !msg.bot_id) {
            // Only include messages we haven't seen
            if (!since || parseFloat(msg.ts!) * 1000 > since) {
              responses.push({
                sessionId,
                response: msg.text || '',
                timestamp: parseFloat(msg.ts!) * 1000,
                userId: msg.user,
                threadTs: lastMessageTs
              });
            }
          }
        }
      } catch (error: any) {
        // If thread_not_found, fall back to channel history
        if (error.error === 'thread_not_found') {
          return this.pollMessages(sessionId, since);
        }
        throw error;
      }
    }

    return responses;
  }

  async getChannelInfo(channelId: string): Promise<{ id: string; name: string }> {
    if (!this.client) {
      throw new Error('Slack client not configured');
    }

    const info = await this.retryWithBackoff(() =>
      this.client!.conversations.info({
        channel: channelId
      })
    );

    return {
      id: channelId,
      name: info.channel?.name || channelId
    };
  }

  addWebhookResponse(response: FeedbackResponse): void {
    const sessionResponses = this.responseQueue.get(response.sessionId) || [];
    sessionResponses.push(response);
    this.responseQueue.set(response.sessionId, sessionResponses);
  }

  getWebhookResponses(sessionId: string): FeedbackResponse[] {
    const responses = this.responseQueue.get(sessionId) || [];
    this.responseQueue.set(sessionId, []); // Clear after reading
    return responses;
  }

  async findChannel(channelName: string): Promise<string | undefined> {
    if (!this.client) {
      throw new Error('Slack client not configured');
    }

    logger.error(`[findChannel] Looking for channel: ${channelName}`);

    // First try with exact name match
    const list = await this.retryWithBackoff(() =>
      this.client!.conversations.list({
        limit: 1000,
        types: 'public_channel,private_channel',
        exclude_archived: true
      })
    );

    logger.error(`[findChannel] Found ${list.channels?.length || 0} channels`);

    // Try exact match first
    let channel = list.channels?.find(c => c.name === channelName);
    
    // If not found, try case-insensitive match
    if (!channel) {
      channel = list.channels?.find(c => 
        c.name?.toLowerCase() === channelName.toLowerCase()
      );
    }

    if (!channel) {
      logger.error(`[findChannel] Channel ${channelName} not found in list`);
      return undefined;
    }

    logger.error(`[findChannel] Found channel ${channel.name} (ID: ${channel.id}, is_member: ${channel.is_member})`);

    // If found but bot is not a member, try to join
    if (channel && !channel.is_member) {
      logger.error(`[findChannel] Bot is not a member of #${channel.name}, attempting to join...`);
      try {
        await this.retryWithBackoff(() =>
          this.client!.conversations.join({
            channel: channel.id!
          })
        );
        logger.error(`[findChannel] ✅ Successfully joined channel #${channel.name}`);
      } catch (error: any) {
        logger.error(`[findChannel] ❌ Failed to join channel #${channel.name}: ${error.message}`);
        logger.error(`[findChannel] Error details:`, error);
        // Still return the channel ID, let the user know in the UI
      }
    } else if (channel && channel.is_member) {
      logger.error(`[findChannel] Bot is already a member of #${channel.name}`);
    }

    return channel?.id;
  }

  async listChannels(): Promise<Array<{ name: string; is_member: boolean }>> {
    if (!this.client) {
      throw new Error('Slack client not configured');
    }

    const list = await this.retryWithBackoff(() =>
      this.client!.conversations.list({
        limit: 1000,
        types: 'public_channel,private_channel',
        exclude_archived: true
      })
    );

    return (list.channels || [])
      .filter(c => c.name && !c.is_archived)
      .map(c => ({
        name: c.name!,
        is_member: c.is_member || false
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries = this.rateLimitRetries
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (error.error === 'rate_limited' && retries > 0) {
        const retryAfter = error.retryAfter || this.rateLimitDelay / 1000;
        logger.debug(`[SlackClient] Rate limited, retrying after ${retryAfter}s (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.retryWithBackoff(operation, retries - 1);
      }
      // Add rate limit info to error for upstream handling
      if (error.error === 'rate_limited') {
        error.retryAfter = error.retryAfter || 60;
      }
      throw error;
    }
  }

  async getLastThreadTs(sessionId: string): Promise<string | undefined> {
    return this.sessionThreadTs.get(sessionId);
  }
  
  async getSession(sessionId: string): Promise<any> {
    return this.configManager.getSession(sessionId);
  }

  hasValidToken(): boolean {
    return !!this.client;
  }

  async addReaction(channel: string, timestamp: string, reaction: string): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    await this.retryWithBackoff(() =>
      this.client!.reactions.add({
        channel,
        timestamp,
        name: reaction
      })
    );
  }

  async sendStatusUpdate(message: string, context?: string): Promise<string> {
    if (!this.client) {
      throw new Error('Slack client not configured');
    }

    const session = await this.sessionManager.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }

    const sessionEmoji = this.getSessionEmoji(session.sessionId);
    
    // Simple format - just message with status indicator
    let formattedMessage = message;
    
    // Add mention at the beginning if configured
    if (session.sessionContact) {
      // Handle special case for @here
      const mention = session.sessionContact === 'here' ? '@here' : `<@${session.sessionContact}>`;
      formattedMessage = `${mention} ${formattedMessage}`;
    }
    
    const blocks: any[] = [];
    
    // Add session label and status indicator
    const contextElements = [];
    if (session.sessionLabel) {
      contextElements.push({
        type: "mrkdwn",
        text: `${sessionEmoji} ${session.sessionLabel}`
      });
    }
    contextElements.push({
      type: "mrkdwn",
      text: '📊 **Status Update. No reply needed**'
    });
    
    if (contextElements.length > 0) {
      blocks.push({
        type: "context",
        elements: contextElements
      });
    }
    
    // Include context in the main message if provided
    let messageText = formattedMessage;
    if (context) {
      messageText += `\n\n${context}`;
    }
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: messageText
      }
    });

    const result = await this.retryWithBackoff(() =>
      this.client!.chat.postMessage({
        channel: session.channelId,
        text: message, // Fallback text
        blocks,
        username: `Claude Session ${session.sessionId}`,
        icon_emoji: sessionEmoji
      })
    );

    // Store the message timestamp
    this.lastMessageTs.set(session.sessionId, result.ts!);

    return result.ts!;
  }
}