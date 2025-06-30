import { Session } from './types.js';
export interface PollingConfig {
    autoStart: boolean;
    initialDelay: number;
    normalInterval: number;
    idleInterval: number;
    maxInterval: number;
    activityThreshold: number;
}
export declare class PollingManager {
    private intervals;
    private lastActivity;
    private currentInterval;
    private timerId;
    private isPolling;
    private session;
    private pollCallback;
    constructor(session: Session, pollCallback: () => Promise<void>, config?: Partial<PollingConfig>);
    /**
     * Start automatic polling with intelligent backoff
     */
    startPolling(): void;
    /**
     * Stop automatic polling
     */
    stopPolling(): void;
    /**
     * Record activity to adjust polling frequency
     */
    recordActivity(): void;
    /**
     * Get current polling interval
     */
    getCurrentInterval(): number;
    /**
     * Check if currently polling
     */
    isActive(): boolean;
    private scheduleNextPoll;
}
//# sourceMappingURL=polling-manager.d.ts.map