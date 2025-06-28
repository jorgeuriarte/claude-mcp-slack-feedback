import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { SlackClient } from './slack-client.js';
import { FeedbackResponse } from './types.js';

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
          }
        }
      } catch (error) {
        console.error('Error processing interactive payload:', error);
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
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`Webhook server listening on port ${this.port}`);
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
}