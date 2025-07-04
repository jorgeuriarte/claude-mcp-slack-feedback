// Tests for WebhookServer are disabled as webhooks are now handled by Cloud Run
// The local webhook server is no longer used in the architecture

/*
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

  describe('start', () => {
    it('should start the server on the specified port', async () => {
      await webhookServer.start();
      expect(webhookServer.isRunning()).toBe(true);
    });

    it('should throw if already running', async () => {
      await webhookServer.start();
      await expect(webhookServer.start()).rejects.toThrow('Server already running');
    });
  });

  describe('stop', () => {
    it('should stop the server', async () => {
      await webhookServer.start();
      await webhookServer.stop();
      expect(webhookServer.isRunning()).toBe(false);
    });

    it('should not throw if already stopped', async () => {
      await expect(webhookServer.stop()).resolves.not.toThrow();
    });
  });

  describe('health endpoint', () => {
    it('should respond with status ok', async () => {
      await webhookServer.start();
      const app = (webhookServer as any).app;
      
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toEqual({
        status: 'ok',
        sessionId: sessionId
      });
    });
  });

  describe('slack events', () => {
    it('should handle URL verification challenge', async () => {
      await webhookServer.start();
      const app = (webhookServer as any).app;
      
      const response = await request(app)
        .post('/slack/events')
        .send({
          type: 'url_verification',
          challenge: 'test-challenge-123'
        })
        .expect(200);
      
      expect(response.body).toEqual({ challenge: 'test-challenge-123' });
    });

    it('should process message events', async () => {
      await webhookServer.start();
      const app = (webhookServer as any).app;
      
      await request(app)
        .post('/slack/events')
        .send({
          type: 'event_callback',
          event: {
            type: 'message',
            user: 'U123456',
            text: 'Test response',
            ts: '1234567890.123456'
          }
        })
        .expect(200);
      
      expect(mockSlackClient.addWebhookResponse).toHaveBeenCalledWith({
        sessionId: sessionId,
        response: 'Test response',
        timestamp: expect.any(Number),
        userId: 'U123456',
        threadTs: '1234567890.123456'
      });
    });

    it('should handle interactive messages', async () => {
      await webhookServer.start();
      const app = (webhookServer as any).app;
      
      const payload = {
        type: 'interactive_message',
        user: { id: 'U123456' },
        actions: [{
          value: 'yes'
        }]
      };
      
      await request(app)
        .post('/slack/interactive')
        .send({ payload: JSON.stringify(payload) })
        .expect(200);
      
      expect(mockSlackClient.addWebhookResponse).toHaveBeenCalledWith({
        sessionId: sessionId,
        response: 'yes',
        timestamp: expect.any(Number),
        userId: 'U123456',
        threadTs: ''
      });
    });

    it('should ignore bot messages', async () => {
      await webhookServer.start();
      const app = (webhookServer as any).app;
      
      await request(app)
        .post('/slack/events')
        .send({
          type: 'event_callback',
          event: {
            type: 'message',
            bot_id: 'B123456',
            text: 'Bot message'
          }
        })
        .expect(200);
      
      expect(mockSlackClient.addWebhookResponse).not.toHaveBeenCalled();
    });
  });
});
*/

describe('WebhookServer', () => {
  it('is disabled - webhooks handled by Cloud Run', () => {
    expect(true).toBe(true);
  });
});