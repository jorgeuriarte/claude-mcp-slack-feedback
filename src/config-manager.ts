import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { ConfigData, SlackConfig, UserConfig, Session } from './types.js';

export class ConfigManager {
  private configPath: string;
  private config: ConfigData;

  constructor() {
    const configDir = path.join(homedir(), '.claude-mcp-slack-feedback');
    this.configPath = path.join(configDir, 'config.json');
    this.config = {
      users: [],
      sessions: [],
      lastUpdated: new Date()
    };
  }

  async init(): Promise<void> {
    try {
      await this.ensureConfigDir();
      await this.loadConfig();
    } catch (error) {
      console.error('Error initializing config:', error);
      await this.saveConfig();
    }
  }

  private async ensureConfigDir(): Promise<void> {
    const dir = path.dirname(this.configPath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const parsed = JSON.parse(data);
      this.config = {
        ...parsed,
        lastUpdated: new Date(parsed.lastUpdated),
        sessions: parsed.sessions?.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          lastActivity: new Date(s.lastActivity)
        })) || []
      };
    } catch (error) {
      console.log('No existing config found, creating new one');
    }
  }

  async saveConfig(): Promise<void> {
    this.config.lastUpdated = new Date();
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  getSlackConfig(): SlackConfig | undefined {
    return this.config.slack;
  }

  async setSlackConfig(config: SlackConfig): Promise<void> {
    this.config.slack = config;
    await this.saveConfig();
  }

  getUser(email?: string, username?: string): UserConfig | undefined {
    if (email) {
      return this.config.users.find(u => u.email === email);
    }
    if (username) {
      return this.config.users.find(u => u.username === username);
    }
    return undefined;
  }

  getUsers(): UserConfig[] {
    return this.config.users;
  }

  async addUser(user: UserConfig): Promise<void> {
    const existing = this.config.users.findIndex(u => u.userId === user.userId);
    if (existing >= 0) {
      this.config.users[existing] = user;
    } else {
      this.config.users.push(user);
    }
    await this.saveConfig();
  }

  getActiveSessions(): Session[] {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.config.sessions.filter(
      s => s.status === 'active' && s.lastActivity > dayAgo
    );
  }

  getUserSessions(userId: string): Session[] {
    return this.getActiveSessions().filter(s => s.userId === userId);
  }

  async addSession(session: Session): Promise<void> {
    this.config.sessions.push(session);
    await this.saveConfig();
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    const index = this.config.sessions.findIndex(s => s.sessionId === sessionId);
    if (index >= 0) {
      this.config.sessions[index] = {
        ...this.config.sessions[index],
        ...updates,
        lastActivity: new Date()
      };
      await this.saveConfig();
    }
  }

  async expireOldSessions(): Promise<void> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let changed = false;
    
    this.config.sessions.forEach(session => {
      if (session.status === 'active' && session.lastActivity < dayAgo) {
        session.status = 'expired';
        changed = true;
      }
    });

    if (changed) {
      await this.saveConfig();
    }
  }

  getSession(sessionId: string): Session | undefined {
    return this.config.sessions.find(s => s.sessionId === sessionId);
  }
}