import { CloudPollingClient } from './cloud-polling-client.js';
export class PollingStrategy {
    slackClient;
    sessionId;
    mode;
    useCloudPolling;
    cloudClient;
    // Factory methods for backward compatibility
    static createCloudPolling(slackClient, sessionId, mode) {
        return new PollingStrategy(slackClient, sessionId, mode, true);
    }
    static createFeedbackRequired(slackClient, sessionId) {
        return new PollingStrategy(slackClient, sessionId, 'feedback-required', false);
    }
    static createCourtesyInform(slackClient, sessionId) {
        return new PollingStrategy(slackClient, sessionId, 'courtesy-inform', false);
    }
    intensivePollingInterval = 3; // seconds - check every 3 seconds during intensive phase
    intensivePollingDuration = 60; // seconds - intensive polling for 1 minute
    pauseInterval = 15; // seconds - pause between intensive polling cycles
    minPollingInterval = 1; // minimum seconds between webhook calls - can be aggressive
    lastApiCallTime = 0;
    rateLimitRetryAfter = 0;
    negativePatterns = [
        /^(no|wait|stop|espera|para|alto)$/i,
        /^(cancel|cancelar|abortar|abort)$/i,
        /^(tengo otra idea|mejor no|pensándolo mejor)$/i,
        /^(espera un momento|dame un segundo)$/i,
        /^(no.*(?:hagas|sigas|continues))$/i,
        /^(mejor.*no)$/i
    ];
    constructor(slackClient, sessionId, mode, useCloudPolling = false, cloudClient) {
        this.slackClient = slackClient;
        this.sessionId = sessionId;
        this.mode = mode;
        this.useCloudPolling = useCloudPolling;
        this.cloudClient = cloudClient;
        // Initialize cloud client if not provided but cloud polling is enabled
        if (useCloudPolling && !cloudClient) {
            this.cloudClient = new CloudPollingClient();
        }
    }
    /**
     * Execute polling strategy based on mode
     */
    async execute(threadTs) {
        console.log(`[PollingStrategy] Starting ${this.mode} polling for session ${this.sessionId}`);
        if (this.mode === 'feedback-required') {
            return this.executeFeedbackPolling(threadTs);
        }
        else {
            return this.executeCourtesyPolling(threadTs);
        }
    }
    /**
     * Feedback required mode - polls indefinitely until response
     */
    async executeFeedbackPolling(threadTs) {
        let attemptCount = 0;
        let cycleStartTime = Date.now();
        let lastCheckTime = Date.now();
        let inIntensivePhase = true;
        while (true) {
            // Check for responses
            console.log(`[PollingStrategy] Feedback polling attempt ${attemptCount + 1}, checking for messages since ${new Date(lastCheckTime).toLocaleTimeString()}`);
            try {
                // Ensure we respect rate limits
                await this.ensureRateLimit();
                let responses;
                if (this.useCloudPolling && this.cloudClient) {
                    // Poll from Cloud Functions
                    const threadTs = await this.slackClient.getLastThreadTs?.(this.sessionId);
                    const cloudResponses = await this.cloudClient.pollResponses(this.sessionId, threadTs);
                    // Also poll channel messages (aggressive polling against our own server)
                    const session = await this.slackClient.getSession?.(this.sessionId);
                    let channelResponses = [];
                    if (session?.channelId) {
                        channelResponses = await this.cloudClient.pollChannelMessages(session.channelId);
                    }
                    // Combine thread and channel responses
                    const allResponses = [...cloudResponses, ...channelResponses];
                    responses = allResponses.map(r => ({
                        response: r.text,
                        timestamp: r.timestamp,
                        user: r.user,
                        sessionId: this.sessionId,
                        userId: r.user,
                        threadTs: r.threadTs
                    }));
                }
                else {
                    // Poll directly from Slack
                    responses = await this.slackClient.pollMessages(this.sessionId, lastCheckTime);
                }
                attemptCount++;
                if (responses.length > 0) {
                    console.log(`[PollingStrategy] Found ${responses.length} responses, returning`);
                    return {
                        responses,
                        shouldStop: false,
                        requiresFeedback: false
                    };
                }
            }
            catch (error) {
                if (error.message?.includes('rate_limited') || error.message?.includes('rate limit')) {
                    // Extract retry-after from error if available
                    const retryAfter = error.retryAfter || 60;
                    this.handleRateLimit(retryAfter);
                    console.log(`[PollingStrategy] Rate limit hit, waiting ${retryAfter}s before next attempt`);
                    // Notify user about rate limit
                    await this.sendRateLimitMessage(threadTs);
                    // Wait for rate limit period
                    await this.sleep(retryAfter * 1000);
                    // Reset intensive phase after rate limit
                    cycleStartTime = Date.now();
                    inIntensivePhase = true;
                    // Continue polling after rate limit wait
                    continue;
                }
                throw error; // Re-throw non-rate-limit errors
            }
            // Determine wait time based on phase
            let waitSeconds;
            const elapsedSeconds = (Date.now() - cycleStartTime) / 1000;
            if (inIntensivePhase) {
                // During intensive phase (first minute)
                if (elapsedSeconds < this.intensivePollingDuration) {
                    waitSeconds = this.intensivePollingInterval;
                    console.log(`[PollingStrategy] Intensive polling: waiting ${waitSeconds}s (${Math.round(this.intensivePollingDuration - elapsedSeconds)}s remaining)`);
                }
                else {
                    // Switch to pause phase
                    inIntensivePhase = false;
                    waitSeconds = this.pauseInterval;
                    console.log(`[PollingStrategy] Entering pause phase: waiting ${waitSeconds}s`);
                    await this.sendWaitingMessage(threadTs);
                }
            }
            else {
                // After pause, restart intensive phase
                cycleStartTime = Date.now();
                inIntensivePhase = true;
                waitSeconds = this.intensivePollingInterval;
                console.log(`[PollingStrategy] Restarting intensive polling cycle`);
            }
            // Wait for next poll
            await this.sleep(waitSeconds * 1000);
            lastCheckTime = Date.now();
        }
    }
    /**
     * Courtesy inform mode - polls for a limited time to check if user wants to change course
     */
    async executeCourtesyPolling(_threadTs) {
        let attemptCount = 0;
        let cycleStartTime = Date.now();
        let lastCheckTime = Date.now();
        // For courtesy mode, we only do one intensive cycle
        const maxDuration = this.intensivePollingDuration + this.pauseInterval;
        while ((Date.now() - cycleStartTime) / 1000 < maxDuration) {
            const elapsedSeconds = (Date.now() - cycleStartTime) / 1000;
            const waitSeconds = elapsedSeconds < this.intensivePollingDuration
                ? this.intensivePollingInterval
                : this.pauseInterval;
            console.log(`[PollingStrategy] Courtesy polling ${attemptCount + 1}, waiting ${waitSeconds}s`);
            try {
                // Ensure we respect rate limits
                await this.ensureRateLimit();
                let responses;
                if (this.useCloudPolling && this.cloudClient) {
                    // Poll from Cloud Functions
                    const threadTs = await this.slackClient.getLastThreadTs?.(this.sessionId);
                    const cloudResponses = await this.cloudClient.pollResponses(this.sessionId, threadTs);
                    // Also poll channel messages (aggressive polling against our own server)
                    const session = await this.slackClient.getSession?.(this.sessionId);
                    let channelResponses = [];
                    if (session?.channelId) {
                        channelResponses = await this.cloudClient.pollChannelMessages(session.channelId);
                    }
                    // Combine thread and channel responses
                    const allResponses = [...cloudResponses, ...channelResponses];
                    responses = allResponses.map(r => ({
                        response: r.text,
                        timestamp: r.timestamp,
                        user: r.user,
                        sessionId: this.sessionId,
                        userId: r.user,
                        threadTs: r.threadTs
                    }));
                }
                else {
                    // Poll directly from Slack
                    responses = await this.slackClient.pollMessages(this.sessionId, lastCheckTime);
                }
                attemptCount++;
                if (responses.length > 0) {
                    // Check if any response is negative (user wants to stop/change)
                    const hasNegativeResponse = responses.some(r => this.isNegativeResponse(r.response));
                    if (hasNegativeResponse) {
                        console.log(`[PollingStrategy] Negative response detected, stopping with requiresFeedback=true`);
                        return {
                            responses,
                            shouldStop: true,
                            requiresFeedback: true
                        };
                    }
                    // Non-negative response in courtesy mode
                    console.log(`[PollingStrategy] Non-negative response received, continuing`);
                    return {
                        responses,
                        shouldStop: false,
                        requiresFeedback: false
                    };
                }
            }
            catch (error) {
                if (error.message?.includes('rate_limited') || error.message?.includes('rate limit')) {
                    // Extract retry-after from error if available
                    const retryAfter = error.retryAfter || 60;
                    this.handleRateLimit(retryAfter);
                    console.log(`[PollingStrategy] Rate limit hit in courtesy mode, waiting ${retryAfter}s`);
                    // Wait for rate limit to clear
                    await this.sleep(retryAfter * 1000);
                    continue;
                }
                throw error; // Re-throw non-rate-limit errors
            }
            // Wait for next poll
            await this.sleep(waitSeconds * 1000);
            lastCheckTime = Date.now();
            attemptCount++;
        }
        // No response after full cycle - continue with work
        console.log(`[PollingStrategy] Courtesy polling completed with no response, continuing with work`);
        return {
            responses: [],
            shouldStop: false,
            requiresFeedback: false
        };
    }
    /**
     * Check if response indicates user wants to stop/change course
     */
    isNegativeResponse(text) {
        const normalizedText = text.trim().toLowerCase();
        return this.negativePatterns.some(pattern => pattern.test(normalizedText));
    }
    /**
     * Send a message indicating we're still waiting
     */
    async sendWaitingMessage(_threadTs) {
        // TODO: Implement progress update method in SlackClient
        console.log('[PollingStrategy] Would send waiting message here');
    }
    /**
     * Send a message about rate limiting
     */
    async sendRateLimitMessage(_threadTs) {
        // TODO: Implement progress update method in SlackClient
        console.log('[PollingStrategy] Would send rate limit message here');
    }
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Ensure we don't exceed rate limits
     */
    async ensureRateLimit() {
        // Check if we're in a rate limit retry period
        if (this.rateLimitRetryAfter > Date.now()) {
            const waitTime = this.rateLimitRetryAfter - Date.now();
            console.log(`[PollingStrategy] In rate limit retry period, waiting ${Math.ceil(waitTime / 1000)}s`);
            await this.sleep(waitTime);
        }
        // Ensure minimum interval between API calls
        const timeSinceLastCall = Date.now() - this.lastApiCallTime;
        if (timeSinceLastCall < this.minPollingInterval * 1000) {
            const waitTime = (this.minPollingInterval * 1000) - timeSinceLastCall;
            await this.sleep(waitTime);
        }
        this.lastApiCallTime = Date.now();
    }
    /**
     * Handle rate limit by setting retry-after time
     */
    handleRateLimit(retryAfter) {
        this.rateLimitRetryAfter = Date.now() + (retryAfter * 1000);
        console.log(`[PollingStrategy] Rate limit handled, retry after ${new Date(this.rateLimitRetryAfter).toLocaleTimeString()}`);
    }
}
//# sourceMappingURL=polling-strategy.js.map