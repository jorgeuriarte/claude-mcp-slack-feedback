import { Session } from './types.js';
import { logger } from './logger.js';

export interface PollingConfig {
  autoStart: boolean;
  initialDelay: number;
  normalInterval: number;
  idleInterval: number;
  maxInterval: number;
  activityThreshold: number; // milliseconds to consider "recent activity"
}

export class PollingManager {
  private intervals = {
    initial: 2000,      // 2 seconds initial
    normal: 5000,       // 5 seconds normal
    idle: 30000,        // 30 seconds when idle
    max: 60000          // 1 minute maximum
  };
  
  private lastActivity: number = Date.now();
  private currentInterval: number;
  private timerId: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private session: Session;
  private pollCallback: () => Promise<void>;
  
  constructor(
    session: Session, 
    pollCallback: () => Promise<void>,
    config?: Partial<PollingConfig>
  ) {
    this.session = session;
    this.pollCallback = pollCallback;
    this.currentInterval = this.intervals.initial;
    
    // Apply custom config if provided
    if (config) {
      if (config.initialDelay) this.intervals.initial = config.initialDelay;
      if (config.normalInterval) this.intervals.normal = config.normalInterval;
      if (config.idleInterval) this.intervals.idle = config.idleInterval;
      if (config.maxInterval) this.intervals.max = config.maxInterval;
    }
  }
  
  /**
   * Start automatic polling with intelligent backoff
   */
  startPolling(): void {
    if (this.isPolling) {
      logger.debug('[PollingManager] Already polling, skipping start');
      return;
    }
    
    logger.debug(`[PollingManager] Starting automatic polling for session ${this.session.sessionId}`);
    this.isPolling = true;
    this.scheduleNextPoll();
  }
  
  /**
   * Stop automatic polling
   */
  stopPolling(): void {
    logger.debug(`[PollingManager] Stopping polling for session ${this.session.sessionId}`);
    this.isPolling = false;
    
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
  
  /**
   * Record activity to adjust polling frequency
   */
  recordActivity(): void {
    this.lastActivity = Date.now();
    
    // If we're in idle mode, speed up polling again
    if (this.currentInterval > this.intervals.normal) {
      logger.debug('[PollingManager] Activity detected, increasing poll frequency');
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
  getCurrentInterval(): number {
    return this.currentInterval;
  }
  
  /**
   * Check if currently polling
   */
  isActive(): boolean {
    return this.isPolling;
  }
  
  private scheduleNextPoll(): void {
    if (!this.isPolling) return;
    
    // Adjust interval based on activity
    const timeSinceLastActivity = Date.now() - this.lastActivity;
    const activityThreshold = 60000; // 1 minute
    
    if (timeSinceLastActivity < activityThreshold) {
      // Recent activity: use normal interval
      this.currentInterval = this.intervals.normal;
    } else {
      // No recent activity: gradually increase interval
      this.currentInterval = Math.min(
        this.currentInterval * 1.5,
        this.intervals.max
      );
    }
    
    logger.debug(`[PollingManager] Next poll in ${this.currentInterval}ms`);
    
    this.timerId = setTimeout(async () => {
      try {
        await this.pollCallback();
      } catch (error) {
        logger.error('[PollingManager] Poll callback error:', error);
      }
      
      // Schedule next poll
      this.scheduleNextPoll();
    }, this.currentInterval);
  }
}