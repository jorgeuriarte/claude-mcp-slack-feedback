export declare class TunnelManager {
    private tunnelProcess?;
    private tunnelUrl?;
    private port;
    constructor(port: number);
    start(): Promise<string>;
    stop(): Promise<void>;
    getTunnelUrl(): string | undefined;
    isRunning(): boolean;
    checkCloudflaredInstalled(): Promise<boolean>;
    static isAvailable(): Promise<boolean>;
    installCloudflared(): Promise<void>;
}
//# sourceMappingURL=tunnel-manager.d.ts.map