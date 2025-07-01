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
export declare class CloudPollingClient {
    private cloudFunctionUrl;
    private lastTimestamp;
    constructor(cloudFunctionUrl?: string);
    /**
     * Poll for new responses from Cloud Functions
     */
    pollResponses(sessionId: string, threadTs?: string): Promise<CloudResponse[]>;
    /**
     * Check health of Cloud Functions
     */
    checkHealth(): Promise<boolean>;
    /**
     * Poll for channel messages from Cloud Functions
     */
    pollChannelMessages(channelId: string): Promise<CloudResponse[]>;
    /**
     * Clear stored responses for a session (cleanup)
     */
    clearSession(sessionId: string): Promise<void>;
}
//# sourceMappingURL=cloud-polling-client.d.ts.map