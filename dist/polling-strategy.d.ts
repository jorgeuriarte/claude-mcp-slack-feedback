import { FeedbackResponse } from './types.js';
import { SlackClient } from './slack-client.js';
import { CloudPollingClient } from './cloud-polling-client.js';
export type PollingMode = 'feedback-required' | 'courtesy-inform';
export interface PollingResult {
    responses: FeedbackResponse[];
    shouldStop: boolean;
    requiresFeedback?: boolean;
}
export declare class PollingStrategy {
    private slackClient;
    private sessionId;
    private mode;
    private useCloudPolling;
    private cloudClient?;
    static createCloudPolling(slackClient: SlackClient, sessionId: string, mode: PollingMode): PollingStrategy;
    static createFeedbackRequired(slackClient: SlackClient, sessionId: string): PollingStrategy;
    static createCourtesyInform(slackClient: SlackClient, sessionId: string): PollingStrategy;
    private readonly intensivePollingInterval;
    private readonly intensivePollingDuration;
    private readonly pauseInterval;
    private readonly minPollingInterval;
    private lastApiCallTime;
    private rateLimitRetryAfter;
    private readonly negativePatterns;
    constructor(slackClient: SlackClient, sessionId: string, mode: PollingMode, useCloudPolling?: boolean, cloudClient?: CloudPollingClient | undefined);
    /**
     * Execute polling strategy based on mode
     */
    execute(threadTs?: string): Promise<PollingResult>;
    /**
     * Feedback required mode - polls indefinitely until response
     */
    private executeFeedbackPolling;
    /**
     * Courtesy inform mode - polls for a limited time to check if user wants to change course
     */
    private executeCourtesyPolling;
    /**
     * Check if response indicates user wants to stop/change course
     */
    private isNegativeResponse;
    /**
     * Send a message indicating we're still waiting
     */
    private sendWaitingMessage;
    /**
     * Send a message about rate limiting
     */
    private sendRateLimitMessage;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
    /**
     * Ensure we don't exceed rate limits
     */
    private ensureRateLimit;
    /**
     * Handle rate limit by setting retry-after time
     */
    private handleRateLimit;
}
//# sourceMappingURL=polling-strategy.d.ts.map