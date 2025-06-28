import { SessionManager } from '../session-manager';
import { ConfigManager } from '../config-manager';
import { UserConfig, Session } from '../types';

jest.mock('../config-manager');

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  
  const mockUser: UserConfig = {
    userId: 'U123',
    username: 'testuser',
    email: 'test@example.com',
    mainChannelId: 'C123'
  };

  beforeEach(() => {
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    sessionManager = new SessionManager(mockConfigManager);
    
    mockConfigManager.getActiveSessions.mockReturnValue([]);
    mockConfigManager.expireOldSessions.mockResolvedValue(undefined);
    mockConfigManager.addSession.mockResolvedValue(undefined);
    mockConfigManager.updateSession.mockResolvedValue(undefined);
  });

  describe('init', () => {
    it('should expire old sessions and track used ports', async () => {
      const activeSessions: Session[] = [
        {
          sessionId: 'existing',
          userId: 'U456',
          channelId: 'C456',
          port: 3001,
          createdAt: new Date(),
          lastActivity: new Date(),
          status: 'active',
          mode: 'webhook'
        }
      ];
      
      mockConfigManager.getActiveSessions.mockReturnValue(activeSessions);
      
      await sessionManager.init();
      
      expect(mockConfigManager.expireOldSessions).toHaveBeenCalled();
      expect(mockConfigManager.getActiveSessions).toHaveBeenCalled();
    });
  });

  describe('createSession', () => {
    it('should create a new session with unique port', async () => {
      const session = await sessionManager.createSession(mockUser);
      
      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe(mockUser.userId);
      expect(session.port).toBeGreaterThanOrEqual(3000);
      expect(session.port).toBeLessThanOrEqual(4000);
      expect(session.status).toBe('active');
      expect(session.mode).toBe('webhook');
      
      expect(mockConfigManager.addSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.userId,
          status: 'active'
        })
      );
    });

    it('should avoid port conflicts', async () => {
      mockConfigManager.getActiveSessions.mockReturnValue([
        {
          sessionId: 'existing',
          userId: 'U456',
          channelId: 'C456',
          port: 3000,
          createdAt: new Date(),
          lastActivity: new Date(),
          status: 'active',
          mode: 'webhook'
        }
      ]);
      
      await sessionManager.init();
      const session = await sessionManager.createSession(mockUser);
      
      expect(session.port).not.toBe(3000);
    });
  });

  describe('getCurrentSession', () => {
    it('should return current active session', async () => {
      const session = await sessionManager.createSession(mockUser);
      mockConfigManager.getSession.mockReturnValue(session);
      
      const current = await sessionManager.getCurrentSession();
      
      expect(current).toEqual(session);
    });

    it('should return undefined if no current session', async () => {
      const current = await sessionManager.getCurrentSession();
      
      expect(current).toBeUndefined();
    });
  });

  describe('updateSessionActivity', () => {
    it('should update session last activity', async () => {
      const sessionId = 'test-session';
      
      await sessionManager.updateSessionActivity(sessionId);
      
      expect(mockConfigManager.updateSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          lastActivity: expect.any(Date)
        })
      );
    });
  });

  describe('updateSessionWebhook', () => {
    it('should update session webhook details', async () => {
      const sessionId = 'test-session';
      const webhookUrl = 'http://localhost:3000/webhook';
      const tunnelUrl = 'https://tunnel.example.com';
      
      await sessionManager.updateSessionWebhook(sessionId, webhookUrl, tunnelUrl);
      
      expect(mockConfigManager.updateSession).toHaveBeenCalledWith(
        sessionId,
        {
          webhookUrl,
          tunnelUrl,
          mode: 'webhook'
        }
      );
    });
  });

  describe('setSessionPollingMode', () => {
    it('should switch session to polling mode', async () => {
      const sessionId = 'test-session';
      
      await sessionManager.setSessionPollingMode(sessionId);
      
      expect(mockConfigManager.updateSession).toHaveBeenCalledWith(
        sessionId,
        {
          mode: 'polling',
          webhookUrl: undefined,
          tunnelUrl: undefined
        }
      );
    });
  });

  describe('endSession', () => {
    it('should expire session and free port', async () => {
      const session = await sessionManager.createSession(mockUser);
      mockConfigManager.getSession.mockReturnValue(session);
      
      await sessionManager.endSession(session.sessionId);
      
      expect(mockConfigManager.updateSession).toHaveBeenCalledWith(
        session.sessionId,
        { status: 'expired' }
      );
    });
  });

  describe('channel naming', () => {
    it('should generate correct channel names', () => {
      const sessionId = 'abc123';
      
      expect(sessionManager.getChannelName('jorge', sessionId)).toBe('claude-jorg-abc123');
      expect(sessionManager.getMainChannelName('jorge')).toBe('claude-jorge-main');
    });
  });
});