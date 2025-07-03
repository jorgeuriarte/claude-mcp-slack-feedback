export interface SlackConfig {
    botToken: string;
    workspaceUrl: string;
    teamId: string;
}
export interface UserConfig {
    userId: string;
    username: string;
    email?: string;
    mainChannelId: string;
}
export interface Session {
    sessionId: string;
    userId: string;
    channelId: string;
    channelName?: string;
    sessionLabel?: string;
    sessionContact?: string;
    port: number;
    createdAt: Date;
    lastActivity: Date;
    status: 'active' | 'expired';
    webhookUrl?: string;
    tunnelUrl?: string;
    mode: 'webhook' | 'polling' | 'hybrid';
    pollingConfig?: {
        autoStart: boolean;
        initialDelay?: number;
        normalInterval?: number;
        idleInterval?: number;
        maxInterval?: number;
    };
    hybridConfig?: {
        webhookTimeout: number;
        fallbackAfterFailures: number;
        healthCheckInterval: number;
    };
}
export interface FeedbackRequest {
    sessionId: string;
    question: string;
    context?: string;
    options?: string[];
    timestamp: number;
    threadTs?: string;
}
export interface FeedbackResponse {
    sessionId: string;
    response: string;
    timestamp: number;
    userId: string;
    threadTs: string;
}
export interface ConfigData {
    slack?: SlackConfig;
    users: UserConfig[];
    sessions: Session[];
    lastUpdated: Date;
}
export interface MCPToolParams {
    setupSlackConfig: {
        botToken: string;
        workspaceUrl: string;
    };
    askFeedback: {
        question: string;
        context?: string;
        options?: string[];
    };
    sendQuestion: {
        question: string;
        context?: string;
        options?: string[];
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        response_type?: 'quick' | 'detailed' | 'any';
    };
    checkResponses: {
        question_id: string;
        include_channel?: boolean;
        channel_window?: number;
    };
    addReaction: {
        channel: string;
        timestamp: string;
        reaction: string;
    };
    getRecentMessages: {
        limit?: number;
    };
    informSlack: {
        message: string;
        context?: string;
    };
    sendSimpleUpdate: {
        message: string;
        threadTs: string;
    };
    updateProgress: {
        message: string;
        threadTs: string;
    };
    getResponses: {
        sessionId?: string;
        since?: number;
    };
    listSessions: Record<string, never>;
}
//# sourceMappingURL=types.d.ts.map