import { HealthMonitor } from '../health-monitor';
import { SessionManager } from '../session-manager';
import { WebhookServer } from '../webhook-server';
import { Session } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('HealthMonitor', () => {
  let mockSession: Session;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockWebhookServer: jest.Mocked<WebhookServer>;
  let healthMonitor: HealthMonitor;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    
    mockSession = {
      sessionId: 'test123',
      userId: 'user123',
      channelId: 'channel123',
      port: 3000,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
      mode: 'hybrid',
      hybridConfig: {
        webhookTimeout: 5000,
        fallbackAfterFailures: 3,
        healthCheckInterval: 1000 // 1 second for testing
      }
    };
    
    mockSessionManager = {
      setSessionMode: jest.fn().mockResolvedValue(undefined),
    } as any;
    
    mockWebhookServer = {
      isRunning: jest.fn().mockReturnValue(true),
      getPort: jest.fn().mockReturnValue(3000),
    } as any;
    
    healthMonitor = new HealthMonitor(mockSession, mockSessionManager, mockWebhookServer);
  });

  afterEach(() => {
    healthMonitor.stopMonitoring();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('startMonitoring', () => {
    it('should start health checks for hybrid mode', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      healthMonitor.startMonitoring();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[HealthMonitor] Starting health checks')
      );
      
      consoleSpy.mockRestore();
    });
    
    it('should not start for non-hybrid modes', () => {
      mockSession.mode = 'polling';
      const monitor = new HealthMonitor(mockSession, mockSessionManager, mockWebhookServer);
      
      monitor.startMonitoring();
      
      // Advance timers - no health checks should occur
      jest.advanceTimersByTime(5000);
      expect(mockWebhookServer.isRunning).not.toHaveBeenCalled();
    });
  });

  describe('recordWebhookFailure', () => {
    it('should switch to polling after max failures', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Record 3 failures
      healthMonitor.recordWebhookFailure('test123');
      healthMonitor.recordWebhookFailure('test123');
      healthMonitor.recordWebhookFailure('test123');
      
      expect(mockSessionManager.setSessionMode).toHaveBeenCalledWith('test123', 'polling');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Max failures reached, switching to polling mode')
      );
      
      consoleSpy.mockRestore();
    });
    
    it('should not switch before reaching max failures', () => {
      healthMonitor.recordWebhookFailure('test123');
      healthMonitor.recordWebhookFailure('test123');
      
      expect(mockSessionManager.setSessionMode).not.toHaveBeenCalled();
    });
  });

  describe('recordWebhookSuccess', () => {
    it('should reset failure count on success', () => {
      // Record some failures
      healthMonitor.recordWebhookFailure('test123');
      healthMonitor.recordWebhookFailure('test123');
      
      // Record success
      healthMonitor.recordWebhookSuccess('test123');
      
      // Now it should take 3 more failures to switch
      healthMonitor.recordWebhookFailure('test123');
      healthMonitor.recordWebhookFailure('test123');
      expect(mockSessionManager.setSessionMode).not.toHaveBeenCalled();
      
      healthMonitor.recordWebhookFailure('test123');
      expect(mockSessionManager.setSessionMode).toHaveBeenCalled();
    });
  });

  describe('health checks', () => {
    it('should perform periodic health checks', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'test123' })
      });
      
      healthMonitor.startMonitoring();
      
      // Wait for initial check after 30 seconds
      jest.advanceTimersByTime(30000);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/health',
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });
    
    it('should record failure when webhook server is not running', async () => {
      mockWebhookServer.isRunning.mockReturnValue(false);
      const recordFailureSpy = jest.spyOn(healthMonitor, 'recordWebhookFailure');
      
      healthMonitor.startMonitoring();
      
      // Trigger health check
      jest.advanceTimersByTime(30000);
      
      expect(recordFailureSpy).toHaveBeenCalledWith('test123');
    });
  });
});