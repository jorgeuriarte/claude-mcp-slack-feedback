import { FeedbackResponse } from './types.js';
import { SlackClient } from './slack-client.js';

export type PollingMode = 'feedback-required' | 'courtesy-inform';

export interface PollingResult {
  responses: FeedbackResponse[];
  shouldStop: boolean;
  requiresFeedback?: boolean;
}

export class PollingStrategy {
  private readonly fibonacciSequence = [2, 3, 5, 8, 13, 21, 34, 55]; // seconds
  private readonly longPollingInterval = 60; // seconds after fibonacci
  private readonly minPollingInterval = 3; // minimum seconds between API calls to respect rate limits
  private lastApiCallTime = 0;
  private rateLimitRetryAfter = 0;
  private readonly negativePatterns = [
    /^(no|wait|stop|espera|para|alto)$/i,
    /^(cancel|cancelar|abortar|abort)$/i,
    /^(tengo otra idea|mejor no|pensándolo mejor)$/i,
    /^(espera un momento|dame un segundo)$/i,
    /^(no.*(?:hagas|sigas|continues))$/i,
    /^(mejor.*no)$/i
  ];

  constructor(
    private slackClient: SlackClient,
    private sessionId: string,
    private mode: PollingMode
  ) {}

  /**
   * Execute polling strategy based on mode
   */
  async execute(threadTs?: string): Promise<PollingResult> {
    console.log(`[PollingStrategy] Starting ${this.mode} polling for session ${this.sessionId}`);
    if (this.mode === 'feedback-required') {
      return this.executeFeedbackPolling(threadTs);
    } else {
      return this.executeCourtesyPolling(threadTs);
    }
  }

  /**
   * Feedback required mode - polls indefinitely until response
   */
  private async executeFeedbackPolling(threadTs?: string): Promise<PollingResult> {
    let attemptCount = 0;
    let fibIndex = 0;
    let lastCheckTime = Date.now();

    while (true) {
      // Check for responses
      console.log(`[PollingStrategy] Feedback polling attempt ${attemptCount + 1}, checking for messages since ${new Date(lastCheckTime).toLocaleTimeString()}`);
      
      try {
        // Ensure we respect rate limits
        await this.ensureRateLimit();
        
        const responses = await this.slackClient.pollMessages(this.sessionId, lastCheckTime);
        
        if (responses.length > 0) {
          console.log(`[PollingStrategy] Found ${responses.length} responses, returning`);
          return {
            responses,
            shouldStop: false,
            requiresFeedback: false
          };
        }
      } catch (error: any) {
        if (error.message?.includes('rate_limited')) {
          // Extract retry-after from error if available
          const retryAfter = error.retryAfter || 60;
          this.handleRateLimit(retryAfter);
          // Continue loop, will wait on next iteration
          continue;
        }
        throw error; // Re-throw non-rate-limit errors
      }

      // Determine wait time
      let waitSeconds: number;
      if (fibIndex < this.fibonacciSequence.length) {
        waitSeconds = this.fibonacciSequence[fibIndex];
        console.log(`[PollingStrategy] No response yet, waiting ${waitSeconds}s (Fibonacci index ${fibIndex})`);
        fibIndex++;
      } else {
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
  private async executeCourtesyPolling(_threadTs?: string): Promise<PollingResult> {
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
        
        const responses = await this.slackClient.pollMessages(this.sessionId, lastCheckTime);
        
        if (responses.length > 0) {
        console.log(`[PollingStrategy] Found ${responses.length} responses in courtesy mode`);
        // Check if any response is negative/blocking
        const hasNegativeResponse = responses.some(r => 
          this.isNegativeResponse(r.response)
        );

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
      } catch (error: any) {
        if (error.message?.includes('rate_limited')) {
          // Extract retry-after from error if available
          const retryAfter = error.retryAfter || 60;
          this.handleRateLimit(retryAfter);
          // Skip this iteration and continue
          fibIndex++;
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
  private isNegativeResponse(text: string): boolean {
    const normalizedText = text.trim().toLowerCase();
    return this.negativePatterns.some(pattern => pattern.test(normalizedText));
  }

  /**
   * Send a message indicating we're still waiting
   */
  private async sendWaitingMessage(threadTs?: string): Promise<void> {
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
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ensure we respect rate limits before making API calls
   */
  private async ensureRateLimit(): Promise<void> {
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
  handleRateLimit(retryAfter: number): void {
    this.rateLimitRetryAfter = Date.now() + (retryAfter * 1000);
    console.log(`[PollingStrategy] Rate limit hit, will retry after ${retryAfter}s`);
  }

  /**
   * Check if the process has been interrupted (placeholder)
   * In real implementation, this would check for ESC key or other interrupt signals
   */
  private checkForInterrupt(): boolean {
    // TODO: Implement actual interrupt checking
    // For now, always return false
    return false;
  }

  /**
   * Create a polling strategy instance
   */
  static createFeedbackRequired(slackClient: SlackClient, sessionId: string): PollingStrategy {
    return new PollingStrategy(slackClient, sessionId, 'feedback-required');
  }

  static createCourtesyInform(slackClient: SlackClient, sessionId: string): PollingStrategy {
    return new PollingStrategy(slackClient, sessionId, 'courtesy-inform');
  }
}