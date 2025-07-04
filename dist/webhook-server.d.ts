import { SlackClient } from './slack-client.js';
export declare class WebhookServer {
    private app;
    private server?;
    private port;
    private sessionId;
    private feedbackResolvers;
    constructor(port: number, sessionId: string, _slackClient: SlackClient);
    private setupRoutes;
    private handleSlackEvent;
    start(): Promise<void>;
    stop(): Promise<void>;
    isRunning(): boolean;
    getPort(): number;
    setFeedbackResolver(sessionId: string, threadTs: string, resolver: (response: any) => void): void;
    clearFeedbackResolver(sessionId: string, threadTs: string): void;
    private resolveFeedback;
}
//# sourceMappingURL=webhook-server.d.ts.map