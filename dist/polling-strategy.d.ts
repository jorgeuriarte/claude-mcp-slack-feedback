import { FeedbackResponse } from './types.js';
import { SlackClient } from './slack-client.js';
export type PollingMode = 'feedback-required' | 'courtesy-inform';
export interface PollingResult {
    responses: FeedbackResponse[];
    shouldStop: boolean;
    requiresFeedback?: boolean;
    requiresInterpretation?: boolean;
    timedOut?: boolean;
}
export declare class PollingStrategy {
    private slackClient;
    private sessionId;
    private mode;
    static create(slackClient: SlackClient, sessionId: string, mode: PollingMode): PollingStrategy;
    private readonly intensivePollingInterval;
    private readonly intensivePollingDuration;
    private readonly pauseInterval;
    private readonly minPollingInterval;
    private lastApiCallTime;
    private rateLimitRetryAfter;
    private cloudClient;
    constructor(slackClient: SlackClient, sessionId: string, mode: PollingMode);
    /**
     * Execute polling strategy based on mode
     */
    execute(threadTs?: string): Promise<PollingResult>;
    /**
     * Execute polling with timeout (for send_question)
     */
    executeWithTimeout(threadTs: string, timeoutSeconds: number): Promise<PollingResult>;
    /**
     * Feedback required mode - polls indefinitely until response
     */
    private executeFeedbackPolling;
    /**
     * Courtesy inform mode - polls for a short duration
     */
    private executeCourtesyPolling;
    private ensureRateLimit;
    private sleep;
}
//# sourceMappingURL=polling-strategy.d.ts.map