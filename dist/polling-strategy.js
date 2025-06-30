import { CloudPollingClient } from './cloud-polling-client.js';
export class PollingStrategy {
    slackClient;
    sessionId;
    mode;
    useCloudPolling;
    cloudClient;
    fibonacciSequence = [5, 8, 13, 21, 34, 55]; // seconds - start at 5s to avoid rate limits
    longPollingInterval = 60; // seconds after fibonacci
    minPollingInterval = 10; // minimum seconds between API calls to respect rate limits
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
        let fibIndex = 0;
        let lastCheckTime = Date.now();
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
                    responses = cloudResponses.map(r => ({
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
                    // Reset to longer intervals to be more conservative
                    if (fibIndex < this.fibonacciSequence.length - 2) {
                        fibIndex = this.fibonacciSequence.length - 2; // Jump to 34s interval
                    }
                    // Continue polling after rate limit wait
                    continue;
                }
                throw error; // Re-throw non-rate-limit errors
            }
            // Determine wait time
            let waitSeconds;
            if (fibIndex < this.fibonacciSequence.length) {
                waitSeconds = this.fibonacciSequence[fibIndex];
                console.log(`[PollingStrategy] No response yet, waiting ${waitSeconds}s (Fibonacci index ${fibIndex})`);
                fibIndex++;
            }
            else {
                // After fibonacci sequence, send waiting message
                if (fibIndex === this.fibonacciSequence.length) {
                    console.log(`[PollingStrategy] Fibonacci sequence exhausted, sending waiting message`);
                    await this.sendWaitingMessage(threadTs);
                    fibIndex++; // Only send once
                }
                waitSeconds = this.longPollingInterval;
                console.log(`[PollingStrategy] Long polling mode, waiting ${waitSeconds}s`);
            }
            // Wait for next poll
            await this.sleep(waitSeconds * 1000);
            lastCheckTime = Date.now();
            attemptCount++;
            // Check if process wants to exit (would need to implement interrupt handling)
            if (this.checkForInterrupt()) {
                return {
                    responses: [],
                    shouldStop: true,
                    requiresFeedback: false
                };
            }
        }
    }
    /**
     * Courtesy inform mode - polls with fibonacci backoff, stops if no response
     */
    async executeCourtesyPolling(_threadTs) {
        let fibIndex = 0;
        let lastCheckTime = Date.now();
        while (fibIndex < this.fibonacciSequence.length) {
            const waitSeconds = this.fibonacciSequence[fibIndex];
            console.log(`[PollingStrategy] Courtesy polling ${fibIndex + 1}/${this.fibonacciSequence.length}, waiting ${waitSeconds}s`);
            // Wait before checking
            await this.sleep(waitSeconds * 1000);
            // Check for responses
            console.log(`[PollingStrategy] Checking for courtesy responses since ${new Date(lastCheckTime).toLocaleTimeString()}`);
            try {
                // Ensure we respect rate limits
                await this.ensureRateLimit();
                let responses;
                if (this.useCloudPolling && this.cloudClient) {
                    // Poll from Cloud Functions
                    const threadTs = await this.slackClient.getLastThreadTs?.(this.sessionId);
                    const cloudResponses = await this.cloudClient.pollResponses(this.sessionId, threadTs);
                    responses = cloudResponses.map(r => ({
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
                if (responses.length > 0) {
                    console.log(`[PollingStrategy] Found ${responses.length} responses in courtesy mode`);
                    // Check if any response is negative/blocking
                    const hasNegativeResponse = responses.some(r => this.isNegativeResponse(r.response));
                    if (hasNegativeResponse) {
                        console.log(`[PollingStrategy] Detected negative response, switching to feedback mode`);
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
                    // Continue with remaining attempts but skip to end of sequence
                    fibIndex = Math.min(fibIndex + 2, this.fibonacciSequence.length - 1);
                    continue;
                }
                throw error; // Re-throw non-rate-limit errors
            }
            lastCheckTime = Date.now();
            fibIndex++;
        }
        // No response after full fibonacci sequence - continue with work
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
    async sendWaitingMessage(threadTs) {
        const messages = [
            "⏳ Sigo esperando tu respuesta. Volveré a revisar en un minuto...",
            "💭 Tomaré que necesitas más tiempo. Seguiré revisando cada minuto.",
            "🔄 Continuaré esperando tu feedback. Revisaré periódicamente."
        ];
        const message = messages[Math.floor(Math.random() * messages.length)];
        if (threadTs) {
            await this.slackClient.updateProgress(message, threadTs);
        }
    }
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Ensure we respect rate limits before making API calls
     */
    async ensureRateLimit() {
        const now = Date.now();
        // Check if we're in a rate limit retry period
        if (this.rateLimitRetryAfter > now) {
            const waitTime = this.rateLimitRetryAfter - now;
            console.log(`[PollingStrategy] Rate limited, waiting ${Math.ceil(waitTime / 1000)}s before next API call`);
            await this.sleep(waitTime);
        }
        // Ensure minimum time between API calls
        const timeSinceLastCall = now - this.lastApiCallTime;
        if (timeSinceLastCall < this.minPollingInterval * 1000) {
            const waitTime = (this.minPollingInterval * 1000) - timeSinceLastCall;
            console.log(`[PollingStrategy] Throttling API calls, waiting ${Math.ceil(waitTime / 1000)}s`);
            await this.sleep(waitTime);
        }
        this.lastApiCallTime = Date.now();
    }
    /**
     * Handle rate limit errors from Slack
     */
    handleRateLimit(retryAfter) {
        this.rateLimitRetryAfter = Date.now() + (retryAfter * 1000);
        console.log(`[PollingStrategy] Rate limit hit, will retry after ${retryAfter}s`);
    }
    /**
     * Send a rate limit message to the user
     */
    async sendRateLimitMessage(threadTs) {
        if (!threadTs)
            return;
        try {
            await this.slackClient.updateProgress("⚠️ Alcancé el límite de consultas de Slack. Esperaré un minuto antes de continuar verificando respuestas...", threadTs);
        }
        catch (error) {
            // Ignore errors when sending rate limit message
            console.log(`[PollingStrategy] Could not send rate limit message: ${error}`);
        }
    }
    /**
     * Check if the process has been interrupted (placeholder)
     * In real implementation, this would check for ESC key or other interrupt signals
     */
    checkForInterrupt() {
        // TODO: Implement actual interrupt checking
        // For now, always return false
        return false;
    }
    /**
     * Create a polling strategy instance
     */
    static createFeedbackRequired(slackClient, sessionId) {
        return new PollingStrategy(slackClient, sessionId, 'feedback-required');
    }
    static createCourtesyInform(slackClient, sessionId) {
        return new PollingStrategy(slackClient, sessionId, 'courtesy-inform');
    }
    static createCloudPolling(slackClient, sessionId, cloudFunctionUrl) {
        const cloudClient = new CloudPollingClient(cloudFunctionUrl);
        return new PollingStrategy(slackClient, sessionId, 'feedback-required', true, cloudClient);
    }
}
//# sourceMappingURL=polling-strategy.js.map