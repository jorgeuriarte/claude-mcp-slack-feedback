export interface SlackConfig {
  botToken: string;
  workspaceUrl: string;
  teamId: string;
}

export interface UserConfig {
  userId: string;
  username: string;
  email?: string;
  mainChannelId: string;
}

export interface Session {
  sessionId: string;
  userId: string;
  channelId: string;
  channelName?: string; // Store the channel name for display
  sessionLabel?: string; // Custom label for the session
  sessionContact?: string; // Contact to mention in messages (@user or @here)
  port: number;
  createdAt: Date;
  lastActivity: Date;
  status: 'active' | 'expired';
  webhookUrl?: string;
  tunnelUrl?: string;
  mode: 'webhook' | 'polling' | 'hybrid';
  pollingConfig?: {
    autoStart: boolean;
    initialDelay?: number;
    normalInterval?: number;
    idleInterval?: number;
    maxInterval?: number;
  };
  hybridConfig?: {
    webhookTimeout: number;
    fallbackAfterFailures: number;
    healthCheckInterval: number;
  };
}

export interface FeedbackRequest {
  sessionId: string;
  question: string;
  context?: string;
  options?: string[];
  timestamp: number;
  threadTs?: string;
}

export interface FeedbackResponse {
  sessionId: string;
  response: string;
  timestamp: number;
  userId: string;
  threadTs: string;
}

export interface ConfigData {
  slack?: SlackConfig;
  users: UserConfig[];
  sessions: Session[];
  lastUpdated: Date;
}

export interface MCPToolParams {
  setupSlackConfig: {
    botToken: string;
    workspaceUrl: string;
  };
  askFeedback: {
    question: string;
    context?: string;
    options?: string[];
  };
  informSlack: {
    message: string;
    context?: string;
  };
  updateProgress: {
    message: string;
    threadTs: string;
  };
  getResponses: {
    sessionId?: string;
    since?: number;
  };
  listSessions: Record<string, never>;
}