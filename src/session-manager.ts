import { randomBytes } from 'crypto';
import { Session, UserConfig } from './types.js';
import { ConfigManager } from './config-manager.js';
import { PollingManager } from './polling-manager.js';
import { HealthMonitor } from './health-monitor.js';

export class SessionManager {
  private configManager: ConfigManager;
  private currentSessionId?: string;
  private usedPorts: Set<number> = new Set();
  private pollingManagers: Map<string, PollingManager> = new Map();
  private healthMonitors: Map<string, HealthMonitor> = new Map();

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

  async createSession(user: UserConfig, mode: 'webhook' | 'polling' | 'hybrid' = 'hybrid'): Promise<Session> {
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
      mode,
      pollingConfig: {
        autoStart: mode === 'polling' || mode === 'hybrid',
        initialDelay: 2000,
        normalInterval: 5000,
        idleInterval: 30000,
        maxInterval: 60000
      },
      hybridConfig: {
        webhookTimeout: 5000,
        fallbackAfterFailures: 3,
        healthCheckInterval: 300000 // 5 minutes
      }
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

  static extractSessionLabelFromPath(): string {
    // Extract meaningful session name from current working directory
    const cwd = process.cwd();
    const pathParts = cwd.split('/').filter(p => p && p !== '');
    
    // Take last 2-3 meaningful parts
    if (pathParts.length >= 2) {
      const relevant = pathParts.slice(-3).filter(p => 
        !p.startsWith('.') && // Skip hidden directories
        p !== 'src' && // Skip common subdirectories
        p !== 'dist' &&
        p !== 'node_modules'
      );
      
      if (relevant.length >= 2) {
        // Join last 2 parts with hyphen
        return relevant.slice(-2).join('-');
      } else if (relevant.length === 1) {
        return relevant[0];
      }
    }
    
    // Fallback to last directory name
    return pathParts[pathParts.length - 1] || 'workspace';
  }

  // Polling Manager methods
  createPollingManager(session: Session, pollCallback: () => Promise<void>): PollingManager {
    const manager = new PollingManager(session, pollCallback, session.pollingConfig);
    this.pollingManagers.set(session.sessionId, manager);
    return manager;
  }

  getPollingManager(sessionId: string): PollingManager | undefined {
    return this.pollingManagers.get(sessionId);
  }

  async startPolling(sessionId: string, pollCallback: () => Promise<void>): Promise<void> {
    const session = await this.configManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    let manager = this.pollingManagers.get(sessionId);
    if (!manager) {
      manager = this.createPollingManager(session, pollCallback);
    }

    manager.startPolling();
    console.log(`[SessionManager] Started polling for session ${sessionId}`);
  }

  stopPolling(sessionId: string): void {
    const manager = this.pollingManagers.get(sessionId);
    if (manager) {
      manager.stopPolling();
      console.log(`[SessionManager] Stopped polling for session ${sessionId}`);
    }
  }

  recordPollingActivity(sessionId: string): void {
    const manager = this.pollingManagers.get(sessionId);
    if (manager) {
      manager.recordActivity();
    }
  }

  async setSessionMode(sessionId: string, mode: 'webhook' | 'polling' | 'hybrid'): Promise<void> {
    await this.configManager.updateSession(sessionId, { mode });
    
    // Update polling based on new mode
    if (mode === 'webhook') {
      this.stopPolling(sessionId);
    } else if (mode === 'polling' || mode === 'hybrid') {
      const session = await this.configManager.getSession(sessionId);
      if (session?.pollingConfig?.autoStart) {
        // Will be started by the caller with appropriate callback
        console.log(`[SessionManager] Mode set to ${mode}, polling will be started by caller`);
      }
    }
  }

  async cleanupSession(sessionId: string): Promise<void> {
    // Stop polling if active
    this.stopPolling(sessionId);
    
    // Stop health monitoring
    this.stopHealthMonitoring(sessionId);
    
    // Remove managers
    this.pollingManagers.delete(sessionId);
    this.healthMonitors.delete(sessionId);
    
    // End session
    await this.endSession(sessionId);
  }

  // Health Monitor methods
  createHealthMonitor(session: Session, webhookServer?: any): HealthMonitor {
    const monitor = new HealthMonitor(session, this, webhookServer);
    this.healthMonitors.set(session.sessionId, monitor);
    return monitor;
  }

  getHealthMonitor(sessionId: string): HealthMonitor | undefined {
    return this.healthMonitors.get(sessionId);
  }

  startHealthMonitoring(sessionId: string, webhookServer?: any): void {
    const session = this.configManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    let monitor = this.healthMonitors.get(sessionId);
    if (!monitor) {
      monitor = this.createHealthMonitor(session, webhookServer);
    }

    monitor.startMonitoring();
    console.log(`[SessionManager] Started health monitoring for session ${sessionId}`);
  }

  stopHealthMonitoring(sessionId: string): void {
    const monitor = this.healthMonitors.get(sessionId);
    if (monitor) {
      monitor.stopMonitoring();
      console.log(`[SessionManager] Stopped health monitoring for session ${sessionId}`);
    }
  }

  recordWebhookFailure(sessionId: string): void {
    const monitor = this.healthMonitors.get(sessionId);
    if (monitor) {
      monitor.recordWebhookFailure(sessionId);
    }
  }

  recordWebhookSuccess(sessionId: string): void {
    const monitor = this.healthMonitors.get(sessionId);
    if (monitor) {
      monitor.recordWebhookSuccess(sessionId);
    }
  }
}