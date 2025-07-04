import { logger } from './logger.js';
export class HealthMonitor {
    healthCheckInterval = null;
    failureCount = new Map();
    session;
    webhookServer;
    sessionManager;
    constructor(session, sessionManager, webhookServer) {
        this.session = session;
        this.sessionManager = sessionManager;
        this.webhookServer = webhookServer;
    }
    /**
     * Start monitoring webhook health
     */
    startMonitoring() {
        if (this.session.mode !== 'hybrid' || !this.webhookServer) {
            return;
        }
        const checkInterval = this.session.hybridConfig?.healthCheckInterval || 300000; // 5 minutes
        logger.debug(`[HealthMonitor] Starting health checks every ${checkInterval}ms for session ${this.session.sessionId}`);
        this.healthCheckInterval = setInterval(async () => {
            await this.checkWebhookHealth();
        }, checkInterval);
        // Initial check after 30 seconds
        setTimeout(() => this.checkWebhookHealth(), 30000);
    }
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        this.failureCount.clear();
        logger.debug(`[HealthMonitor] Stopped monitoring for session ${this.session.sessionId}`);
    }
    /**
     * Record a webhook failure
     */
    recordWebhookFailure(sessionId) {
        const count = (this.failureCount.get(sessionId) || 0) + 1;
        this.failureCount.set(sessionId, count);
        logger.debug(`[HealthMonitor] Webhook failure #${count} for session ${sessionId}`);
        const maxFailures = this.session.hybridConfig?.fallbackAfterFailures || 3;
        if (count >= maxFailures) {
            logger.debug(`[HealthMonitor] Max failures reached, switching to polling mode`);
            this.switchToPollingMode();
        }
    }
    /**
     * Record a webhook success
     */
    recordWebhookSuccess(sessionId) {
        this.failureCount.delete(sessionId);
        logger.debug(`[HealthMonitor] Webhook success for session ${sessionId}, resetting failure count`);
    }
    /**
     * Check webhook health
     */
    async checkWebhookHealth() {
        if (!this.webhookServer?.isRunning()) {
            logger.debug('[HealthMonitor] Webhook server not running');
            this.recordWebhookFailure(this.session.sessionId);
            return;
        }
        try {
            // Simple health check - verify the server is responsive
            const healthCheckUrl = `http://localhost:${this.webhookServer.getPort()}/health`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(healthCheckUrl, {
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (response.ok) {
                const data = await response.json();
                if (data.sessionId === this.session.sessionId) {
                    logger.debug('[HealthMonitor] Webhook health check passed');
                    this.recordWebhookSuccess(this.session.sessionId);
                    return;
                }
            }
            logger.debug('[HealthMonitor] Webhook health check failed - invalid response');
            this.recordWebhookFailure(this.session.sessionId);
        }
        catch (error) {
            logger.error('[HealthMonitor] Webhook health check error:', error);
            this.recordWebhookFailure(this.session.sessionId);
        }
    }
    /**
     * Switch session to polling mode
     */
    async switchToPollingMode() {
        try {
            await this.sessionManager.setSessionMode(this.session.sessionId, 'polling');
            logger.debug(`[HealthMonitor] Successfully switched session ${this.session.sessionId} to polling mode`);
            // Stop monitoring since we're no longer in hybrid mode
            this.stopMonitoring();
        }
        catch (error) {
            logger.error('[HealthMonitor] Failed to switch to polling mode:', error);
        }
    }
}
//# sourceMappingURL=health-monitor.js.map