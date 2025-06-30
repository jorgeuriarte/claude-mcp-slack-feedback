export class PollingManager {
    intervals = {
        initial: 2000, // 2 seconds initial
        normal: 5000, // 5 seconds normal
        idle: 30000, // 30 seconds when idle
        max: 60000 // 1 minute maximum
    };
    lastActivity = Date.now();
    currentInterval;
    timerId = null;
    isPolling = false;
    session;
    pollCallback;
    constructor(session, pollCallback, config) {
        this.session = session;
        this.pollCallback = pollCallback;
        this.currentInterval = this.intervals.initial;
        // Apply custom config if provided
        if (config) {
            if (config.initialDelay)
                this.intervals.initial = config.initialDelay;
            if (config.normalInterval)
                this.intervals.normal = config.normalInterval;
            if (config.idleInterval)
                this.intervals.idle = config.idleInterval;
            if (config.maxInterval)
                this.intervals.max = config.maxInterval;
        }
    }
    /**
     * Start automatic polling with intelligent backoff
     */
    startPolling() {
        if (this.isPolling) {
            console.log('[PollingManager] Already polling, skipping start');
            return;
        }
        console.log(`[PollingManager] Starting automatic polling for session ${this.session.sessionId}`);
        this.isPolling = true;
        this.scheduleNextPoll();
    }
    /**
     * Stop automatic polling
     */
    stopPolling() {
        console.log(`[PollingManager] Stopping polling for session ${this.session.sessionId}`);
        this.isPolling = false;
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }
    /**
     * Record activity to adjust polling frequency
     */
    recordActivity() {
        this.lastActivity = Date.now();
        // If we're in idle mode, speed up polling again
        if (this.currentInterval > this.intervals.normal) {
            console.log('[PollingManager] Activity detected, increasing poll frequency');
            this.currentInterval = this.intervals.initial;
            // Reschedule if we're currently waiting
            if (this.isPolling && this.timerId) {
                clearTimeout(this.timerId);
                this.scheduleNextPoll();
            }
        }
    }
    /**
     * Get current polling interval
     */
    getCurrentInterval() {
        return this.currentInterval;
    }
    /**
     * Check if currently polling
     */
    isActive() {
        return this.isPolling;
    }
    scheduleNextPoll() {
        if (!this.isPolling)
            return;
        // Adjust interval based on activity
        const timeSinceLastActivity = Date.now() - this.lastActivity;
        const activityThreshold = 60000; // 1 minute
        if (timeSinceLastActivity < activityThreshold) {
            // Recent activity: use normal interval
            this.currentInterval = this.intervals.normal;
        }
        else {
            // No recent activity: gradually increase interval
            this.currentInterval = Math.min(this.currentInterval * 1.5, this.intervals.max);
        }
        console.log(`[PollingManager] Next poll in ${this.currentInterval}ms`);
        this.timerId = setTimeout(async () => {
            try {
                await this.pollCallback();
            }
            catch (error) {
                console.error('[PollingManager] Poll callback error:', error);
            }
            // Schedule next poll
            this.scheduleNextPoll();
        }, this.currentInterval);
    }
}
//# sourceMappingURL=polling-manager.js.map