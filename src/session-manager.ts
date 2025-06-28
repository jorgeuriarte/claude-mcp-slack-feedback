import { randomBytes } from 'crypto';
import { Session, UserConfig } from './types.js';
import { ConfigManager } from './config-manager.js';

export class SessionManager {
  private configManager: ConfigManager;
  private currentSessionId?: string;
  private usedPorts: Set<number> = new Set();

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  async init(): Promise<void> {
    await this.configManager.expireOldSessions();
    
    const activeSessions = this.configManager.getActiveSessions();
    activeSessions.forEach(session => {
      this.usedPorts.add(session.port);
    });
  }

  generateSessionId(): string {
    // Generate shorter session IDs (6 chars) for Slack channel name limits
    return randomBytes(3).toString('hex');
  }

  private async findAvailablePort(): Promise<number> {
    const minPort = 3000;
    const maxPort = 4000;
    
    for (let port = minPort; port <= maxPort; port++) {
      if (!this.usedPorts.has(port)) {
        return port;
      }
    }
    
    throw new Error('No available ports in range 3000-4000');
  }

  async createSession(user: UserConfig): Promise<Session> {
    const sessionId = this.generateSessionId();
    const port = await this.findAvailablePort();
    
    const session: Session = {
      sessionId,
      userId: user.userId,
      channelId: '', // Will be set when channel is created
      port,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
      mode: 'webhook' // Default to webhook, fallback to polling if needed
    };

    this.usedPorts.add(port);
    await this.configManager.addSession(session);
    this.currentSessionId = sessionId;
    
    return session;
  }

  async getCurrentSession(): Promise<Session | undefined> {
    if (!this.currentSessionId) {
      return undefined;
    }
    
    const session = this.configManager.getSession(this.currentSessionId);
    if (session && session.status === 'active') {
      return session;
    }
    
    return undefined;
  }

  async setCurrentSession(sessionId: string): Promise<void> {
    const session = this.configManager.getSession(sessionId);
    if (session && session.status === 'active') {
      this.currentSessionId = sessionId;
      await this.updateSessionActivity(sessionId);
    } else {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.configManager.updateSession(sessionId, {
      lastActivity: new Date()
    });
  }

  async updateSessionChannel(sessionId: string, channelId: string): Promise<void> {
    await this.configManager.updateSession(sessionId, {
      channelId
    });
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    await this.configManager.updateSession(sessionId, updates);
  }

  async updateSessionWebhook(sessionId: string, webhookUrl: string, tunnelUrl: string): Promise<void> {
    await this.configManager.updateSession(sessionId, {
      webhookUrl,
      tunnelUrl,
      mode: 'webhook'
    });
  }

  async setSessionPollingMode(sessionId: string): Promise<void> {
    await this.configManager.updateSession(sessionId, {
      mode: 'polling',
      webhookUrl: undefined,
      tunnelUrl: undefined
    });
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.configManager.getSession(sessionId);
    if (session) {
      this.usedPorts.delete(session.port);
      await this.configManager.updateSession(sessionId, {
        status: 'expired'
      });
      
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = undefined;
      }
    }
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return this.configManager.getUserSessions(userId);
  }

  async getAllActiveSessions(): Promise<Session[]> {
    return this.configManager.getActiveSessions();
  }

  getChannelName(username: string, sessionId: string): string {
    // Ensure channel name is under 21 chars (Slack limit)
    // Format: claude-user-123abc
    const shortUsername = username.substring(0, 4);
    return `claude-${shortUsername}-${sessionId}`;
  }

  getMainChannelName(username: string): string {
    return `claude-${username}-main`;
  }
}