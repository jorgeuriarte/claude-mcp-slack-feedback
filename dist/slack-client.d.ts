import { ConfigManager } from './config-manager.js';
import { SessionManager } from './session-manager.js';
import { FeedbackRequest, FeedbackResponse, UserConfig } from './types.js';
export declare class SlackClient {
    private client?;
    private configManager;
    private sessionManager;
    private responseQueue;
    private rateLimitRetries;
    private rateLimitDelay;
    private lastMessageTs;
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
    pollMessages(sessionId: string, since?: number): Promise<FeedbackResponse[]>;
    getChannelInfo(channelId: string): Promise<{
        id: string;
        name: string;
    }>;
    addWebhookResponse(response: FeedbackResponse): void;
    getWebhookResponses(sessionId: string): FeedbackResponse[];
    findChannel(channelName: string): Promise<string | undefined>;
    listChannels(): Promise<Array<{
        name: string;
        is_member: boolean;
    }>>;
    private retryWithBackoff;
}
//# sourceMappingURL=slack-client.d.ts.map