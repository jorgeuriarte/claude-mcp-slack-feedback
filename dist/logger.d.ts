export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}
export declare class Logger {
    private static instance;
    private logFile;
    private logLevel;
    private writeStream;
    private constructor();
    static getInstance(): Logger;
    private log;
    error(message: string, error?: Error | any): void;
    warn(message: string, data?: any): void;
    info(message: string, data?: any): void;
    debug(message: string, data?: any): void;
    setupErrorHandlers(): void;
    close(): void;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map