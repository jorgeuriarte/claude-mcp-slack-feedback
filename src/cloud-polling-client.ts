/**
 * Client for polling responses from Cloud Functions
 */

export interface CloudResponse {
  user: string;
  text: string;
  ts: string;
  threadTs: string;
  channel: string;
  channelName: string;
  timestamp: number;
}

export interface PollResponseData {
  sessionId: string;
  responses: CloudResponse[];
  hasMore: boolean;
  lastTimestamp: number;
}

export class CloudPollingClient {
  private cloudFunctionUrl: string;
  private lastTimestamp: Map<string, number> = new Map();

  constructor(cloudFunctionUrl?: string) {
    this.cloudFunctionUrl = cloudFunctionUrl || process.env.CLOUD_FUNCTION_URL || 'https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app';
  }

  /**
   * Poll for new responses from Cloud Functions
   */
  async pollResponses(sessionId: string, threadTs?: string): Promise<CloudResponse[]> {
    const key = threadTs ? `${sessionId}:${threadTs}` : sessionId;
    const since = this.lastTimestamp.get(key) || 0;
    
    const endpoint = threadTs 
      ? `/responses/${sessionId}/${threadTs}`
      : `/responses/${sessionId}`;
    
    const url = `${this.cloudFunctionUrl}${endpoint}?since=${since}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Cloud function returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as PollResponseData;
      
      // Update last timestamp
      if (data.lastTimestamp) {
        this.lastTimestamp.set(key, data.lastTimestamp);
      }
      
      return data.responses || [];
    } catch (error) {
      console.error(`[CloudPollingClient] Error polling responses:`, error);
      return [];
    }
  }

  /**
   * Check health of Cloud Functions
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.cloudFunctionUrl}/health`);
      const data = await response.json() as { status: string };
      return data.status === 'healthy';
    } catch (error) {
      console.error('[CloudPollingClient] Health check failed:', error);
      return false;
    }
  }

  /**
   * Clear stored responses for a session (cleanup)
   */
  async clearSession(sessionId: string): Promise<void> {
    try {
      await fetch(`${this.cloudFunctionUrl}/responses/${sessionId}`, {
        method: 'DELETE'
      });
      
      // Clear local timestamps
      const keysToDelete: string[] = [];
      for (const key of this.lastTimestamp.keys()) {
        if (key.startsWith(sessionId)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.lastTimestamp.delete(key));
    } catch (error) {
      console.error(`[CloudPollingClient] Error clearing session:`, error);
    }
  }
}