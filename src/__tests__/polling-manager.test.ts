import { PollingManager } from '../polling-manager';
import { Session } from '../types';

describe('PollingManager', () => {
  let mockSession: Session;
  let mockPollCallback: jest.Mock;
  let pollingManager: PollingManager;

  beforeEach(() => {
    jest.useFakeTimers();
    
    mockSession = {
      sessionId: 'test123',
      userId: 'user123',
      channelId: 'channel123',
      port: 3000,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
      mode: 'polling',
      pollingConfig: {
        autoStart: true,
        initialDelay: 100,
        normalInterval: 200,
        idleInterval: 1000,
        maxInterval: 2000
      }
    };
    
    mockPollCallback = jest.fn().mockResolvedValue(undefined);
    pollingManager = new PollingManager(mockSession, mockPollCallback, mockSession.pollingConfig);
  });

  afterEach(() => {
    pollingManager.stopPolling();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('startPolling', () => {
    it('should start polling with initial interval', () => {
      pollingManager.startPolling();
      
      expect(pollingManager.isActive()).toBe(true);
      expect(mockPollCallback).not.toHaveBeenCalled();
      
      // Fast forward initial interval
      jest.advanceTimersByTime(100);
      
      expect(mockPollCallback).toHaveBeenCalledTimes(1);
    });
    
    it('should not start if already polling', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      pollingManager.startPolling();
      pollingManager.startPolling();
      
      expect(consoleSpy).toHaveBeenCalledWith('[PollingManager] Already polling, skipping start');
      
      consoleSpy.mockRestore();
    });
  });

  describe('interval adjustment', () => {
    it('should use normal interval after recent activity', async () => {
      pollingManager.startPolling();
      pollingManager.recordActivity();
      
      // First poll at initial interval
      jest.advanceTimersByTime(100);
      expect(mockPollCallback).toHaveBeenCalledTimes(1);
      
      // Wait for callback to complete
      await Promise.resolve();
      
      // Second poll should be at normal interval (200ms)
      jest.advanceTimersByTime(200);
      expect(mockPollCallback).toHaveBeenCalledTimes(2);
    });
    
    it('should increase interval when idle', async () => {
      pollingManager.startPolling();
      
      // Set last activity to 2 minutes ago
      (pollingManager as any).lastActivity = Date.now() - 120000;
      
      // First poll
      jest.advanceTimersByTime(100);
      expect(mockPollCallback).toHaveBeenCalledTimes(1);
      
      await Promise.resolve();
      
      // Interval should increase
      const nextInterval = pollingManager.getCurrentInterval();
      expect(nextInterval).toBeGreaterThan(200);
    });
  });

  describe('stopPolling', () => {
    it('should stop polling and clear timers', () => {
      pollingManager.startPolling();
      
      expect(pollingManager.isActive()).toBe(true);
      
      pollingManager.stopPolling();
      
      expect(pollingManager.isActive()).toBe(false);
      
      // Advance time - callback should not be called
      jest.advanceTimersByTime(1000);
      expect(mockPollCallback).not.toHaveBeenCalled();
    });
  });

  describe('recordActivity', () => {
    it('should reset interval to initial when activity is recorded during idle', () => {
      pollingManager.startPolling();
      
      // Set to idle state
      (pollingManager as any).currentInterval = 1000;
      
      pollingManager.recordActivity();
      
      expect(pollingManager.getCurrentInterval()).toBe(100); // initial delay
    });
  });
});