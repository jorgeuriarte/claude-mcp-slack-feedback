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
    private readonly fibonacciSequence;
    private readonly longPollingInterval;
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
     * Courtesy inform mode - polls with fibonacci backoff, stops if no response
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
     * Sleep for specified milliseconds
     */
    private sleep;
    /**
     * Ensure we respect rate limits before making API calls
     */
    private ensureRateLimit;
    /**
     * Handle rate limit errors from Slack
     */
    handleRateLimit(retryAfter: number): void;
    /**
     * Send a rate limit message to the user
     */
    private sendRateLimitMessage;
    /**
     * Check if the process has been interrupted (placeholder)
     * In real implementation, this would check for ESC key or other interrupt signals
     */
    private checkForInterrupt;
    /**
     * Create a polling strategy instance
     */
    static createFeedbackRequired(slackClient: SlackClient, sessionId: string): PollingStrategy;
    static createCourtesyInform(slackClient: SlackClient, sessionId: string): PollingStrategy;
    static createCloudPolling(slackClient: SlackClient, sessionId: string, cloudFunctionUrl?: string): PollingStrategy;
}
//# sourceMappingURL=polling-strategy.d.ts.map