import { WebhookServer } from '../webhook-server';
import { SlackClient } from '../slack-client';
import request from 'supertest';

jest.mock('../slack-client');

describe('WebhookServer', () => {
  let webhookServer: WebhookServer;
  let mockSlackClient: jest.Mocked<SlackClient>;
  const port = 3456;
  const sessionId = 'test-session';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSlackClient = new SlackClient(null as any, null as any) as jest.Mocked<SlackClient>;
    mockSlackClient.addWebhookResponse = jest.fn();
    
    webhookServer = new WebhookServer(port, sessionId, mockSlackClient);
  });

  afterEach(async () => {
    if (webhookServer.isRunning()) {
      await webhookServer.stop();
    }
  });

  describe('server lifecycle', () => {
    it('should start and stop server', async () => {
      expect(webhookServer.isRunning()).toBe(false);
      
      await webhookServer.start();
      expect(webhookServer.isRunning()).toBe(true);
      
      await webhookServer.stop();
      expect(webhookServer.isRunning()).toBe(false);
    });

    it('should return correct port', () => {
      expect(webhookServer.getPort()).toBe(port);
    });
  });

  describe('endpoints', () => {
    beforeEach(async () => {
      await webhookServer.start();
    });

    it('should respond to health check', async () => {
      const response = await request(`http://localhost:${port}`)
        .get('/health')
        .expect(200);
      
      expect(response.body).toEqual({
        status: 'ok',
        sessionId: sessionId
      });
    });

    it('should handle Slack URL verification', async () => {
      const challenge = 'test-challenge-123';
      
      const response = await request(`http://localhost:${port}`)
        .post('/slack/events')
        .send({
          type: 'url_verification',
          challenge: challenge
        })
        .expect(200);
      
      expect(response.text).toBe(challenge);
    });

    it('should handle Slack message events', async () => {
      await request(`http://localhost:${port}`)
        .post('/slack/events')
        .send({
          type: 'event_callback',
          event: {
            type: 'message',
            user: 'U123',
            text: 'Test response',
            ts: '1234567890.123456'
          }
        })
        .expect(200);
      
      expect(mockSlackClient.addWebhookResponse).toHaveBeenCalledWith({
        sessionId: sessionId,
        response: 'Test response',
        timestamp: 1234567890123.456,
        userId: 'U123',
        threadTs: '1234567890.123456'
      });
    });

    it('should handle Slack interactive events', async () => {
      const payload = {
        type: 'block_actions',
        user: { id: 'U456' },
        actions: [{
          value: 'button_clicked',
          text: { text: 'Click me' }
        }],
        message: { ts: '9876543210.654321' }
      };
      
      await request(`http://localhost:${port}`)
        .post('/slack/interactive')
        .send({ payload: JSON.stringify(payload) })
        .expect(200);
      
      expect(mockSlackClient.addWebhookResponse).toHaveBeenCalledWith({
        sessionId: sessionId,
        response: 'button_clicked',
        timestamp: expect.any(Number),
        userId: 'U456',
        threadTs: '9876543210.654321'
      });
    });

    it('should ignore bot messages', async () => {
      await request(`http://localhost:${port}`)
        .post('/slack/events')
        .send({
          type: 'event_callback',
          event: {
            type: 'message',
            bot_id: 'B123',
            text: 'Bot message'
          }
        })
        .expect(200);
      
      expect(mockSlackClient.addWebhookResponse).not.toHaveBeenCalled();
    });
  });
});