import express from 'express';
export class WebhookServer {
    app;
    server;
    port;
    slackClient;
    sessionId;
    constructor(port, sessionId, slackClient) {
        this.port = port;
        this.sessionId = sessionId;
        this.slackClient = slackClient;
        this.app = express();
        this.setupRoutes();
    }
    setupRoutes() {
        this.app.use(express.json());
        // Health check endpoint
        this.app.get('/health', (_req, res) => {
            res.json({ status: 'ok', sessionId: this.sessionId });
        });
        // Slack events webhook
        this.app.post('/slack/events', (req, res) => {
            const body = req.body;
            // Handle URL verification challenge
            if (body.type === 'url_verification' && body.challenge) {
                res.send(body.challenge);
                return;
            }
            // Handle events
            if (body.event) {
                this.handleSlackEvent(body.event);
            }
            res.sendStatus(200);
        });
        // Slack interactive webhook (for button clicks, etc.)
        this.app.post('/slack/interactive', (req, res) => {
            try {
                const payload = JSON.parse(req.body.payload);
                if (payload.type === 'block_actions' || payload.type === 'message_action') {
                    const user = payload.user.id;
                    const action = payload.actions?.[0];
                    if (action) {
                        const response = {
                            sessionId: this.sessionId,
                            response: action.value || action.text?.text || 'Action performed',
                            timestamp: Date.now(),
                            userId: user,
                            threadTs: payload.message?.ts || ''
                        };
                        this.slackClient.addWebhookResponse(response);
                    }
                }
            }
            catch (error) {
                console.error('Error processing interactive payload:', error);
            }
            res.sendStatus(200);
        });
    }
    handleSlackEvent(event) {
        // Only process message events from users (not bots)
        if (event.type === 'message' && event.user && event.text) {
            const response = {
                sessionId: this.sessionId,
                response: event.text,
                timestamp: parseFloat(event.ts || '0') * 1000,
                userId: event.user,
                threadTs: event.thread_ts || event.ts || ''
            };
            this.slackClient.addWebhookResponse(response);
        }
    }
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    console.log(`Webhook server listening on port ${this.port}`);
                    resolve();
                });
                this.server.on('error', (error) => {
                    reject(error);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.server = undefined;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    isRunning() {
        return !!this.server && this.server.listening;
    }
    getPort() {
        return this.port;
    }
}
//# sourceMappingURL=webhook-server.js.map