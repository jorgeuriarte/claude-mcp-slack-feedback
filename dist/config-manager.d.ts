import { SlackConfig, UserConfig, Session } from './types.js';
export declare class ConfigManager {
    private configPath;
    private config;
    constructor();
    init(): Promise<void>;
    private ensureConfigDir;
    private loadConfig;
    saveConfig(): Promise<void>;
    getSlackConfig(): SlackConfig | undefined;
    setSlackConfig(config: SlackConfig): Promise<void>;
    getUser(email?: string, username?: string): UserConfig | undefined;
    getUsers(): UserConfig[];
    addUser(user: UserConfig): Promise<void>;
    getActiveSessions(): Session[];
    getUserSessions(userId: string): Session[];
    addSession(session: Session): Promise<void>;
    updateSession(sessionId: string, updates: Partial<Session>): Promise<void>;
    expireOldSessions(): Promise<void>;
    getSession(sessionId: string): Session | undefined;
}
//# sourceMappingURL=config-manager.d.ts.map