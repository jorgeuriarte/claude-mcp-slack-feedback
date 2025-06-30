import { SlackClient } from './slack-client.js';
export declare class WebhookServer {
    private app;
    private server?;
    private port;
    private slackClient;
    private sessionId;
    constructor(port: number, sessionId: string, slackClient: SlackClient);
    private setupRoutes;
    private handleSlackEvent;
    start(): Promise<void>;
    stop(): Promise<void>;
    isRunning(): boolean;
    getPort(): number;
}
//# sourceMappingURL=webhook-server.d.ts.map