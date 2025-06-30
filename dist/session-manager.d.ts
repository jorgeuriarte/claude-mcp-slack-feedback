import { Session, UserConfig } from './types.js';
import { ConfigManager } from './config-manager.js';
export declare class SessionManager {
    private configManager;
    private currentSessionId?;
    private usedPorts;
    constructor(configManager: ConfigManager);
    init(): Promise<void>;
    generateSessionId(): string;
    private findAvailablePort;
    createSession(user: UserConfig): Promise<Session>;
    getCurrentSession(): Promise<Session | undefined>;
    setCurrentSession(sessionId: string): Promise<void>;
    updateSessionActivity(sessionId: string): Promise<void>;
    updateSessionChannel(sessionId: string, channelId: string): Promise<void>;
    updateSession(sessionId: string, updates: Partial<Session>): Promise<void>;
    updateSessionWebhook(sessionId: string, webhookUrl: string, tunnelUrl: string): Promise<void>;
    setSessionPollingMode(sessionId: string): Promise<void>;
    endSession(sessionId: string): Promise<void>;
    getUserSessions(userId: string): Promise<Session[]>;
    getAllActiveSessions(): Promise<Session[]>;
    getChannelName(username: string, sessionId: string): string;
    getMainChannelName(username: string): string;
    static extractSessionLabelFromPath(): string;
}
//# sourceMappingURL=session-manager.d.ts.map