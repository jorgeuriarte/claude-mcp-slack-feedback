import { WebClient } from '@slack/web-api';
import { ConfigManager } from './config-manager.js';
import { SessionManager } from './session-manager.js';
import { FeedbackRequest, FeedbackResponse, UserConfig } from './types.js';

export class SlackClient {
  private client?: WebClient;
  private configManager: ConfigManager;
  private sessionManager: SessionManager;
  private responseQueue: Map<string, FeedbackResponse[]> = new Map();
  private rateLimitRetries = 3;
  private rateLimitDelay = 1000;

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

  async setToken(botToken: string): Promise<{ workspaceUrl: string; teamId: string }> {
    this.client = new WebClient(botToken);
    
    // Test the token and get workspace info
    const auth = await this.retryWithBackoff(() => this.client!.auth.test());
    if (!auth.ok) {
      throw new Error('Invalid bot token');
    }

    const teamInfo = await this.retryWithBackoff(() => 
      this.client!.team.info({ team: auth.team_id })
    );

    const workspaceUrl = `${teamInfo.team?.domain}.slack.com`;
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
        const existing = list.channels?.find(c => c.name === name);
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

    let message = `**Question from Claude:**\n${request.question}`;
    
    if (request.context) {
      message += `\n\n**Context:**\n${request.context}`;
    }

    if (request.options && request.options.length > 0) {
      message += '\n\n**Suggested responses:**\n';
      request.options.forEach((opt, i) => {
        message += `${i + 1}. ${opt}\n`;
      });
    }

    const result = await this.retryWithBackoff(() =>
      this.client!.chat.postMessage({
        channel: session.channelId,
        text: message,
        mrkdwn: true
      })
    );

    return result.ts!;
  }

  async updateProgress(message: string, threadTs: string): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not configured');
    }

    const session = await this.sessionManager.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }

    await this.retryWithBackoff(() =>
      this.client!.chat.postMessage({
        channel: session.channelId,
        text: `**Progress Update:**\n${message}`,
        thread_ts: threadTs,
        mrkdwn: true
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

    const oldest = since ? (since / 1000).toString() : '0';
    
    const history = await this.retryWithBackoff(() =>
      this.client!.conversations.history({
        channel: session.channelId,
        oldest,
        limit: 100
      })
    );

    const responses: FeedbackResponse[] = [];
    
    for (const msg of history.messages || []) {
      if (msg.user && msg.user !== (await this.client.auth.test()).user_id) {
        responses.push({
          sessionId,
          response: msg.text || '',
          timestamp: parseFloat(msg.ts!) * 1000,
          userId: msg.user,
          threadTs: msg.thread_ts || msg.ts!
        });
      }
    }

    return responses;
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

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries = this.rateLimitRetries
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (error.error === 'rate_limited' && retries > 0) {
        const retryAfter = error.retryAfter || this.rateLimitDelay / 1000;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.retryWithBackoff(operation, retries - 1);
      }
      throw error;
    }
  }
}