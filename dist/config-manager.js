import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { logger } from './logger.js';
export class ConfigManager {
    configPath;
    config;
    constructor() {
        const configDir = path.join(homedir(), '.claude-mcp-slack-feedback');
        this.configPath = path.join(configDir, 'config.json');
        this.config = {
            users: [],
            sessions: [],
            lastUpdated: new Date()
        };
    }
    async init() {
        try {
            await this.ensureConfigDir();
            await this.loadConfig();
        }
        catch (error) {
            logger.error('Error initializing config:', error);
            await this.saveConfig();
        }
    }
    async ensureConfigDir() {
        const dir = path.dirname(this.configPath);
        try {
            await fs.access(dir);
        }
        catch {
            await fs.mkdir(dir, { recursive: true });
        }
    }
    async loadConfig() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            const parsed = JSON.parse(data);
            this.config = {
                ...parsed,
                lastUpdated: new Date(parsed.lastUpdated),
                sessions: parsed.sessions?.map((s) => ({
                    ...s,
                    createdAt: new Date(s.createdAt),
                    lastActivity: new Date(s.lastActivity)
                })) || []
            };
        }
        catch (error) {
            logger.debug('No existing config found, creating new one');
        }
    }
    async saveConfig() {
        this.config.lastUpdated = new Date();
        await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    }
    getSlackConfig() {
        return this.config.slack;
    }
    async setSlackConfig(config) {
        this.config.slack = config;
        await this.saveConfig();
    }
    getUser(email, username) {
        if (email) {
            return this.config.users.find(u => u.email === email);
        }
        if (username) {
            return this.config.users.find(u => u.username === username);
        }
        return undefined;
    }
    getUsers() {
        return this.config.users;
    }
    async addUser(user) {
        const existing = this.config.users.findIndex(u => u.userId === user.userId);
        if (existing >= 0) {
            this.config.users[existing] = user;
        }
        else {
            this.config.users.push(user);
        }
        await this.saveConfig();
    }
    getActiveSessions() {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return this.config.sessions.filter(s => s.status === 'active' && s.lastActivity > dayAgo);
    }
    getUserSessions(userId) {
        return this.getActiveSessions().filter(s => s.userId === userId);
    }
    async addSession(session) {
        this.config.sessions.push(session);
        await this.saveConfig();
    }
    async updateSession(sessionId, updates) {
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
    async expireOldSessions() {
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
    getSession(sessionId) {
        return this.config.sessions.find(s => s.sessionId === sessionId);
    }
}
//# sourceMappingURL=config-manager.js.map