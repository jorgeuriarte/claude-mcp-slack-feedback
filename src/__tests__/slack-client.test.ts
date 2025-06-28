import { SlackClient } from '../slack-client';
import { ConfigManager } from '../config-manager';
import { SessionManager } from '../session-manager';
import { WebClient } from '@slack/web-api';

jest.mock('@slack/web-api');
jest.mock('../config-manager');
jest.mock('../session-manager');

describe('SlackClient', () => {
  let slackClient: SlackClient;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockWebClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    mockSessionManager = new SessionManager(mockConfigManager) as jest.Mocked<SessionManager>;
    
    mockWebClient = {
      auth: { test: jest.fn() } as any,
      team: { info: jest.fn() } as any,
      users: { lookupByEmail: jest.fn(), list: jest.fn() } as any,
      conversations: { create: jest.fn(), list: jest.fn(), history: jest.fn() } as any,
      chat: { postMessage: jest.fn() } as any
    } as any;

    (WebClient as jest.MockedClass<typeof WebClient>).mockImplementation(() => mockWebClient);
    
    slackClient = new SlackClient(mockConfigManager, mockSessionManager);
  });

  describe('init', () => {
    it('should initialize with existing config', async () => {
      mockConfigManager.getSlackConfig.mockReturnValue({
        botToken: 'xoxb-test',
        workspaceUrl: 'test.slack.com',
        teamId: 'T123'
      });

      await slackClient.init();
      
      expect(WebClient).toHaveBeenCalledWith('xoxb-test');
      expect(slackClient.isConfigured()).toBe(true);
    });

    it('should not initialize without config', async () => {
      mockConfigManager.getSlackConfig.mockReturnValue(undefined);
      
      await slackClient.init();
      
      expect(slackClient.isConfigured()).toBe(false);
    });
  });

  describe('setToken', () => {
    it('should validate token and save config', async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        team_id: 'T123',
        user_id: 'U123'
      });
      
      mockWebClient.team.info.mockResolvedValue({
        team: { domain: 'testworkspace' }
      });

      const result = await slackClient.setToken('xoxb-test');
      
      expect(result).toEqual({
        workspaceUrl: 'testworkspace.slack.com',
        teamId: 'T123'
      });
      
      expect(mockConfigManager.setSlackConfig).toHaveBeenCalledWith({
        botToken: 'xoxb-test',
        workspaceUrl: 'testworkspace.slack.com',
        teamId: 'T123'
      });
    });

    it('should throw on invalid token', async () => {
      mockWebClient.auth.test.mockResolvedValue({ ok: false });
      
      await expect(slackClient.setToken('invalid')).rejects.toThrow('Invalid bot token');
    });
  });

  describe('detectUser', () => {
    beforeEach(() => {
      mockConfigManager.getSlackConfig.mockReturnValue({
        botToken: 'xoxb-test',
        workspaceUrl: 'test.slack.com',
        teamId: 'T123'
      });
    });

    it('should return existing user', async () => {
      const existingUser = {
        userId: 'U123',
        username: 'testuser',
        email: 'test@example.com',
        mainChannelId: 'C123'
      };
      
      mockConfigManager.getUser.mockReturnValue(existingUser);
      await slackClient.init();
      
      const user = await slackClient.detectUser();
      
      expect(user).toEqual(existingUser);
    });

    it('should detect user by email', async () => {
      process.env.CLAUDE_USER_EMAIL = 'test@example.com';
      process.env.USER = 'testuser';
      
      mockConfigManager.getUser.mockReturnValue(undefined);
      mockWebClient.users.lookupByEmail.mockResolvedValue({
        user: { id: 'U456' }
      });
      
      mockWebClient.conversations.create.mockResolvedValue({
        channel: { id: 'C456', name: 'claude-testuser-main' }
      });
      
      mockSessionManager.getMainChannelName.mockReturnValue('claude-testuser-main');
      
      await slackClient.init();
      const user = await slackClient.detectUser();
      
      expect(user.userId).toBe('U456');
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      
      delete process.env.CLAUDE_USER_EMAIL;
      delete process.env.USER;
    });
  });

  describe('createChannel', () => {
    beforeEach(async () => {
      mockConfigManager.getSlackConfig.mockReturnValue({
        botToken: 'xoxb-test',
        workspaceUrl: 'test.slack.com',
        teamId: 'T123'
      });
      await slackClient.init();
    });

    it('should create new channel', async () => {
      mockWebClient.conversations.create.mockResolvedValue({
        channel: { id: 'C789', name: 'test-channel' }
      });
      
      const channel = await slackClient.createChannel('test-channel');
      
      expect(channel).toEqual({ id: 'C789', name: 'test-channel' });
    });

    it('should return existing channel if name taken', async () => {
      mockWebClient.conversations.create.mockRejectedValue({
        error: 'name_taken'
      });
      
      mockWebClient.conversations.list.mockResolvedValue({
        channels: [
          { id: 'C999', name: 'test-channel' }
        ]
      });
      
      const channel = await slackClient.createChannel('test-channel');
      
      expect(channel).toEqual({ id: 'C999', name: 'test-channel' });
    });
  });

  describe('sendFeedback', () => {
    beforeEach(async () => {
      mockConfigManager.getSlackConfig.mockReturnValue({
        botToken: 'xoxb-test',
        workspaceUrl: 'test.slack.com',
        teamId: 'T123'
      });
      await slackClient.init();
    });

    it('should send feedback message', async () => {
      mockSessionManager.getCurrentSession.mockResolvedValue({
        sessionId: 'sess-123',
        userId: 'U123',
        channelId: 'C123',
        port: 3000,
        createdAt: new Date(),
        lastActivity: new Date(),
        status: 'active',
        mode: 'webhook'
      });
      
      mockWebClient.chat.postMessage.mockResolvedValue({
        ok: true,
        ts: '1234567890.123456'
      });
      
      const threadTs = await slackClient.sendFeedback({
        sessionId: 'sess-123',
        question: 'Test question?',
        context: 'Test context',
        options: ['Yes', 'No'],
        timestamp: Date.now()
      });
      
      expect(threadTs).toBe('1234567890.123456');
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          text: expect.stringContaining('Test question?'),
          mrkdwn: true
        })
      );
    });
  });

  describe('rate limiting', () => {
    beforeEach(async () => {
      mockConfigManager.getSlackConfig.mockReturnValue({
        botToken: 'xoxb-test',
        workspaceUrl: 'test.slack.com',
        teamId: 'T123'
      });
      await slackClient.init();
    });

    it('should retry on rate limit', async () => {
      mockWebClient.auth.test
        .mockRejectedValueOnce({ error: 'rate_limited', retryAfter: 0.1 })
        .mockResolvedValueOnce({ ok: true, team_id: 'T123' });
      
      const result = await slackClient['retryWithBackoff'](() => 
        mockWebClient.auth.test()
      );
      
      expect((result as any).ok).toBe(true);
      expect(mockWebClient.auth.test).toHaveBeenCalledTimes(2);
    });
  });
});