import { ConfigManager } from '../config-manager';
import { promises as fs } from 'fs';
import path from 'path';
import { homedir } from 'os';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn()
  }),
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const configPath = path.join(homedir(), '.claude-mcp-slack-feedback', 'config.json');

  beforeEach(() => {
    jest.clearAllMocks();
    configManager = new ConfigManager();
  });

  describe('init', () => {
    it('should create config directory if it does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('Not found'));
      mockFs.readFile.mockRejectedValue(new Error('Not found'));

      await configManager.init();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.dirname(configPath),
        { recursive: true }
      );
    });

    it('should load existing config', async () => {
      const mockConfig = {
        slack: { botToken: 'test-token', workspaceUrl: 'test.slack.com', teamId: 'T123' },
        users: [],
        sessions: [],
        lastUpdated: new Date().toISOString()
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.init();

      expect(mockFs.readFile).toHaveBeenCalledWith(configPath, 'utf8');
    });
  });

  describe('Slack config', () => {
    it('should set and get Slack config', async () => {
      const slackConfig = {
        botToken: 'xoxb-test',
        workspaceUrl: 'test.slack.com',
        teamId: 'T123'
      };

      await configManager.setSlackConfig(slackConfig);

      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(configManager.getSlackConfig()).toEqual(slackConfig);
    });
  });

  describe('User management', () => {
    it('should add and retrieve users', async () => {
      const user = {
        userId: 'U123',
        username: 'testuser',
        email: 'test@example.com',
        mainChannelId: 'C123'
      };

      await configManager.addUser(user);

      expect(configManager.getUser('test@example.com')).toEqual(user);
      expect(configManager.getUser(undefined, 'testuser')).toEqual(user);
    });

    it('should update existing user', async () => {
      const user = {
        userId: 'U123',
        username: 'testuser',
        email: 'test@example.com',
        mainChannelId: 'C123'
      };

      await configManager.addUser(user);
      
      const updatedUser = { ...user, mainChannelId: 'C456' };
      await configManager.addUser(updatedUser);

      expect(configManager.getUser('test@example.com')).toEqual(updatedUser);
    });
  });

  describe('Session management', () => {
    it('should add and retrieve sessions', async () => {
      const session = {
        sessionId: 'sess-123',
        userId: 'U123',
        channelId: 'C123',
        port: 3000,
        createdAt: new Date(),
        lastActivity: new Date(),
        status: 'active' as const,
        mode: 'webhook' as const
      };

      await configManager.addSession(session);

      expect(configManager.getSession('sess-123')).toEqual(session);
      expect(configManager.getUserSessions('U123')).toContain(session);
    });

    it('should expire old sessions', async () => {
      const oldSession = {
        sessionId: 'old-sess',
        userId: 'U123',
        channelId: 'C123',
        port: 3000,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        lastActivity: new Date(Date.now() - 25 * 60 * 60 * 1000),
        status: 'active' as const,
        mode: 'webhook' as const
      };

      await configManager.addSession(oldSession);
      await configManager.expireOldSessions();

      const sessions = configManager.getActiveSessions();
      expect(sessions).toHaveLength(0);
    });

    it('should update session', async () => {
      const session = {
        sessionId: 'sess-123',
        userId: 'U123',
        channelId: 'C123',
        port: 3000,
        createdAt: new Date(),
        lastActivity: new Date(),
        status: 'active' as const,
        mode: 'webhook' as const
      };

      await configManager.addSession(session);
      await configManager.updateSession('sess-123', { webhookUrl: 'http://test.com' });

      const updated = configManager.getSession('sess-123');
      expect(updated?.webhookUrl).toBe('http://test.com');
    });
  });
});