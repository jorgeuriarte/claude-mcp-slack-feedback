import { ConfigManager } from './config-manager.js';
import { SessionManager } from './session-manager.js';
import { FeedbackRequest, UserConfig } from './types.js';
export declare class SlackClient {
    private client?;
    private configManager;
    private sessionManager;
    private rateLimitRetries;
    private rateLimitDelay;
    private lastMessageTs;
    private sessionThreadTs;
    constructor(configManager: ConfigManager, sessionManager: SessionManager);
    init(): Promise<void>;
    isConfigured(): boolean;
    setToken(botToken: string, workspaceUrl: string): Promise<{
        workspaceUrl: string;
        teamId: string;
    }>;
    detectUser(): Promise<UserConfig>;
    createChannel(name: string): Promise<{
        id: string;
        name: string;
    }>;
    sendFeedback(request: FeedbackRequest): Promise<string>;
    private getSessionEmoji;
    updateProgress(message: string, threadTs: string): Promise<void>;
    getChannelInfo(channelId: string): Promise<{
        id: string;
        name: string;
    }>;
    findChannel(channelName: string): Promise<string | undefined>;
    listChannels(): Promise<Array<{
        name: string;
        is_member: boolean;
    }>>;
    private retryWithBackoff;
    getLastThreadTs(sessionId: string): Promise<string | undefined>;
    getSession(sessionId: string): Promise<any>;
    hasValidToken(): boolean;
    addReaction(channel: string, timestamp: string, reaction: string): Promise<void>;
    getRecentMessages(channel: string, limit?: number): Promise<any[]>;
    sendSimpleThreadMessage(channel: string, message: string, threadTs: string): Promise<void>;
    sendStatusUpdate(message: string, context?: string): Promise<string>;
}
//# sourceMappingURL=slack-client.d.ts.map