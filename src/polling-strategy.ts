import { FeedbackResponse } from './types.js';
import { SlackClient } from './slack-client.js';
import { CloudPollingClient } from './cloud-polling-client.js';
import { logger } from './logger.js';

export type PollingMode = 'feedback-required' | 'courtesy-inform';

export interface PollingResult {
  responses: FeedbackResponse[];
  shouldStop: boolean;
  requiresFeedback?: boolean;
  requiresInterpretation?: boolean;
  timedOut?: boolean;
}

export class PollingStrategy {
  // Simple factory method - always uses Cloud Run
  static create(slackClient: SlackClient, sessionId: string, mode: PollingMode): PollingStrategy {
    return new PollingStrategy(slackClient, sessionId, mode);
  }

  private readonly intensivePollingInterval = 3; // seconds - check every 3 seconds during intensive phase
  private readonly intensivePollingDuration = 60; // seconds - intensive polling for 1 minute
  private readonly pauseInterval = 15; // seconds - pause between intensive polling cycles
  private readonly minPollingInterval = 1; // minimum seconds between webhook calls - can be aggressive
  private lastApiCallTime = 0;
  private rateLimitRetryAfter = 0;
  private cloudClient: CloudPollingClient;

  constructor(
    private slackClient: SlackClient,
    private sessionId: string,
    private mode: PollingMode
  ) {
    // Always initialize cloud client
    this.cloudClient = new CloudPollingClient();
  }

  /**
   * Execute polling strategy based on mode
   */
  async execute(threadTs?: string): Promise<PollingResult> {
    logger.info(`Starting ${this.mode} polling for session ${this.sessionId}`);
    if (this.mode === 'feedback-required') {
      return this.executeFeedbackPolling(threadTs);
    } else {
      return this.executeCourtesyPolling(threadTs);
    }
  }

  /**
   * Execute polling with timeout (for send_question)
   */
  async executeWithTimeout(threadTs: string, timeoutSeconds: number): Promise<PollingResult> {
    logger.info(`Starting feedback polling with ${timeoutSeconds}s timeout for session ${this.sessionId}`);

    if (timeoutSeconds <= 0) {
      // No timeout - poll indefinitely
      return await this.executeFeedbackPolling(threadTs);
    }

    // Create timeout promise
    const timeoutPromise = new Promise<PollingResult>((resolve) => {
      setTimeout(() => {
        resolve({
          responses: [],
          shouldStop: false,
          timedOut: true
        });
      }, timeoutSeconds * 1000);
    });

    // Race between polling and timeout
    const pollingPromise = this.executeFeedbackPolling(threadTs);
    
    return await Promise.race([pollingPromise, timeoutPromise]);
  }

  /**
   * Feedback required mode - polls indefinitely until response
   */
  private async executeFeedbackPolling(threadTs?: string): Promise<PollingResult> {
    let attemptCount = 0;
    let cycleStartTime = Date.now();
    let lastCheckTime = Date.now();
    let inIntensivePhase = true;

    while (true) {
      // Check for responses
      logger.debug(`Feedback polling attempt ${attemptCount + 1}, checking for messages since ${new Date(lastCheckTime).toLocaleTimeString()}`);
      
      try {
        // Ensure we respect rate limits
        await this.ensureRateLimit();
        
        // Always poll from Cloud Functions
        logger.info(`[POLLING DEBUG] Using Cloud Polling for session ${this.sessionId}`);
        const threadTsToUse = threadTs || await this.slackClient.getLastThreadTs?.(this.sessionId);
        logger.info(`[POLLING DEBUG] Thread TS: ${threadTsToUse || 'none'}`);
        
        const cloudResponses = await this.cloudClient.pollResponses(this.sessionId, threadTsToUse);
        logger.info(`[POLLING DEBUG] Cloud responses: ${cloudResponses.length}`);
        
        // Also poll channel messages (aggressive polling against our own server)
        const session = await this.slackClient.getSession?.(this.sessionId);
        let channelResponses: any[] = [];
        if (session?.channelId) {
          logger.info(`[POLLING DEBUG] Polling channel messages for ${session.channelId}`);
          channelResponses = await this.cloudClient.pollChannelMessages(session.channelId);
          logger.info(`[POLLING DEBUG] Channel responses: ${channelResponses.length}`);
        }
        
        // Combine thread and channel responses
        const allResponses = [...cloudResponses, ...channelResponses];
        
        const responses = allResponses.map(r => ({
          response: r.text,
          timestamp: r.timestamp,
          user: r.user,
          sessionId: this.sessionId,
          userId: r.user,
          threadTs: r.threadTs
        }));

        attemptCount++;

        if (responses.length > 0) {
          logger.debug(`[PollingStrategy] Found ${responses.length} responses, returning`);
          return {
            responses,
            shouldStop: false,
            requiresFeedback: false
          };
        }

        // Check if we're still in the intensive phase
        const elapsedTime = (Date.now() - cycleStartTime) / 1000;
        if (inIntensivePhase && elapsedTime >= this.intensivePollingDuration) {
          logger.debug(`[PollingStrategy] Intensive phase ended, pausing for ${this.pauseInterval}s`);
          inIntensivePhase = false;
          await this.sleep(this.pauseInterval * 1000);
          cycleStartTime = Date.now();
          inIntensivePhase = true;
        } else if (inIntensivePhase) {
          // During intensive phase, poll every intensivePollingInterval seconds
          await this.sleep(this.intensivePollingInterval * 1000);
        }
      } catch (error: any) {
        logger.error('[PollingStrategy] Error during feedback polling:', error);
        
        // Handle rate limiting errors
        if (error.message?.includes('rate limit') || 
            error.message?.includes('rate_limited') ||
            error.isRateLimit) {
          const retryAfter = error.retryAfter || 60;
          logger.warn(`[PollingStrategy] Rate limited, waiting ${retryAfter}s before retrying`);
          this.rateLimitRetryAfter = Date.now() + (retryAfter * 1000);
          await this.sleep(retryAfter * 1000);
        } else {
          // For other errors, wait a bit before retrying
          await this.sleep(5000);
        }
      }
    }
  }

  /**
   * Courtesy inform mode - polls for a short duration
   */
  private async executeCourtesyPolling(threadTs?: string): Promise<PollingResult> {
    const startTime = Date.now();
    const courtesyDuration = 60; // 1 minute courtesy window
    
    logger.info(`Starting courtesy polling for ${courtesyDuration}s`);
    
    while ((Date.now() - startTime) < courtesyDuration * 1000) {
      try {
        await this.ensureRateLimit();
        
        // Always poll from Cloud Functions
        logger.info(`[POLLING DEBUG] Using Cloud Polling for session ${this.sessionId}`);
        const threadTsToUse = threadTs || await this.slackClient.getLastThreadTs?.(this.sessionId);
        logger.info(`[POLLING DEBUG] Thread TS: ${threadTsToUse || 'none'}`);
        
        const cloudResponses = await this.cloudClient.pollResponses(this.sessionId, threadTsToUse);
        logger.info(`[POLLING DEBUG] Cloud responses: ${cloudResponses.length}`);
        
        // Also poll channel messages
        const session = await this.slackClient.getSession?.(this.sessionId);
        let channelResponses: any[] = [];
        if (session?.channelId) {
          logger.info(`[POLLING DEBUG] Polling channel messages for ${session.channelId}`);
          channelResponses = await this.cloudClient.pollChannelMessages(session.channelId);
          logger.info(`[POLLING DEBUG] Channel responses: ${channelResponses.length}`);
        }
        
        // Combine thread and channel responses
        const allResponses = [...cloudResponses, ...channelResponses];
        
        const responses = allResponses.map(r => ({
          response: r.text,
          timestamp: r.timestamp,
          user: r.user,
          sessionId: this.sessionId,
          userId: r.user,
          threadTs: r.threadTs
        }));

        if (responses.length > 0) {
          logger.debug(`[PollingStrategy] Found ${responses.length} responses during courtesy window`);
          return {
            responses,
            shouldStop: false,
            requiresFeedback: false
          };
        }
        
        // Wait before next check
        await this.sleep(this.intensivePollingInterval * 1000);
        
      } catch (error: any) {
        logger.error('[PollingStrategy] Error during courtesy polling:', error);
        
        // Handle rate limiting
        if (error.message?.includes('rate limit') || 
            error.message?.includes('rate_limited') ||
            error.isRateLimit) {
          const retryAfter = error.retryAfter || 60;
          
          // If rate limit retry would exceed courtesy window, just return
          if ((Date.now() + retryAfter * 1000) > (startTime + courtesyDuration * 1000)) {
            logger.info('[PollingStrategy] Rate limit would exceed courtesy window, ending');
            break;
          }
          
          logger.warn(`[PollingStrategy] Rate limited, waiting ${retryAfter}s`);
          this.rateLimitRetryAfter = Date.now() + (retryAfter * 1000);
          await this.sleep(retryAfter * 1000);
        } else {
          // For other errors, wait a bit
          await this.sleep(5000);
        }
      }
    }
    
    logger.info('[PollingStrategy] Courtesy window ended with no responses');
    return {
      responses: [],
      shouldStop: true,
      requiresFeedback: false
    };
  }

  private async ensureRateLimit(): Promise<void> {
    // If we have a rate limit retry time, wait until it's passed
    if (this.rateLimitRetryAfter > Date.now()) {
      const waitTime = this.rateLimitRetryAfter - Date.now();
      logger.debug(`[PollingStrategy] Waiting ${waitTime}ms for rate limit to clear`);
      await this.sleep(waitTime);
    }
    
    // Ensure minimum time between API calls
    const timeSinceLastCall = Date.now() - this.lastApiCallTime;
    if (timeSinceLastCall < this.minPollingInterval * 1000) {
      const waitTime = (this.minPollingInterval * 1000) - timeSinceLastCall;
      await this.sleep(waitTime);
    }
    
    this.lastApiCallTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}