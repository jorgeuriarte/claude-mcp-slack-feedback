import { Session } from './types.js';
import { WebhookServer } from './webhook-server.js';
import { SessionManager } from './session-manager.js';
export declare class HealthMonitor {
    private healthCheckInterval;
    private failureCount;
    private session;
    private webhookServer?;
    private sessionManager;
    constructor(session: Session, sessionManager: SessionManager, webhookServer?: WebhookServer);
    /**
     * Start monitoring webhook health
     */
    startMonitoring(): void;
    /**
     * Stop monitoring
     */
    stopMonitoring(): void;
    /**
     * Record a webhook failure
     */
    recordWebhookFailure(sessionId: string): void;
    /**
     * Record a webhook success
     */
    recordWebhookSuccess(sessionId: string): void;
    /**
     * Check webhook health
     */
    private checkWebhookHealth;
    /**
     * Switch session to polling mode
     */
    private switchToPollingMode;
}
//# sourceMappingURL=health-monitor.d.ts.map