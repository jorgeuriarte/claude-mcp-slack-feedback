import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { SlackClient } from './slack-client.js';
import { FeedbackResponse } from './types.js';
import { logger } from './logger.js';

interface SlackEvent {
  type: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  channel?: string;
}

interface SlackEventWrapper {
  type: string;
  challenge?: string;
  event?: SlackEvent;
}

export class WebhookServer {
  private app: Express;
  private server?: Server;
  private port: number;
  private slackClient: SlackClient;
  private sessionId: string;
  private feedbackResolvers: Map<string, (response: any) => void> = new Map();

  constructor(port: number, sessionId: string, slackClient: SlackClient) {
    this.port = port;
    this.sessionId = sessionId;
    this.slackClient = slackClient;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', sessionId: this.sessionId });
    });

    // Slack events webhook
    this.app.post('/slack/events', (req: Request, res: Response) => {
      const body = req.body as SlackEventWrapper;
      
      // Handle URL verification challenge
      if (body.type === 'url_verification' && body.challenge) {
        res.send(body.challenge);
        return;
      }

      // Handle events
      if (body.event) {
        this.handleSlackEvent(body.event);
      }

      res.sendStatus(200);
    });

    // Slack interactive webhook (for button clicks, etc.)
    this.app.post('/slack/interactive', (req: Request, res: Response) => {
      try {
        const payload = JSON.parse(req.body.payload);
        
        if (payload.type === 'block_actions' || payload.type === 'message_action') {
          const user = payload.user.id;
          const action = payload.actions?.[0];
          
          if (action) {
            const response: FeedbackResponse = {
              sessionId: this.sessionId,
              response: action.value || action.text?.text || 'Action performed',
              timestamp: Date.now(),
              userId: user,
              threadTs: payload.message?.ts || ''
            };
            
            this.slackClient.addWebhookResponse(response);
            
            // If there's a resolver waiting for this response, resolve it
            if (payload.message?.ts) {
              this.resolveFeedback(this.sessionId, payload.message.ts, response);
            }
          }
        }
      } catch (error) {
        logger.error('Error processing interactive payload:', error);
      }
      
      res.sendStatus(200);
    });
  }

  private handleSlackEvent(event: SlackEvent): void {
    // Only process message events from users (not bots)
    if (event.type === 'message' && event.user && event.text) {
      const response: FeedbackResponse = {
        sessionId: this.sessionId,
        response: event.text,
        timestamp: parseFloat(event.ts || '0') * 1000,
        userId: event.user,
        threadTs: event.thread_ts || event.ts || ''
      };
      
      this.slackClient.addWebhookResponse(response);
      
      // If there's a resolver waiting for this response, resolve it
      if (event.thread_ts) {
        this.resolveFeedback(this.sessionId, event.thread_ts, response);
      }
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.debug(`Webhook server listening on port ${this.port}`);
          resolve();
        });
        
        this.server.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = undefined;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  isRunning(): boolean {
    return !!this.server && this.server.listening;
  }

  getPort(): number {
    return this.port;
  }

  setFeedbackResolver(sessionId: string, threadTs: string, resolver: (response: any) => void): void {
    const key = `${sessionId}:${threadTs}`;
    this.feedbackResolvers.set(key, resolver);
    logger.debug(`[WebhookServer] Set feedback resolver for ${key}`);
  }

  clearFeedbackResolver(sessionId: string, threadTs: string): void {
    const key = `${sessionId}:${threadTs}`;
    this.feedbackResolvers.delete(key);
    logger.debug(`[WebhookServer] Cleared feedback resolver for ${key}`);
  }

  private resolveFeedback(sessionId: string, threadTs: string, response: any): void {
    const key = `${sessionId}:${threadTs}`;
    const resolver = this.feedbackResolvers.get(key);
    if (resolver) {
      resolver(response);
      this.feedbackResolvers.delete(key);
      logger.debug(`[WebhookServer] Resolved feedback for ${key}`);
    }
  }
}