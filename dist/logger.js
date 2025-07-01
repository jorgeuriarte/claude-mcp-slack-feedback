import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (LogLevel = {}));
export class Logger {
    static instance;
    logFile;
    logLevel;
    writeStream = null;
    constructor() {
        // Create logs directory
        const logDir = path.join(homedir(), '.claude-mcp-slack-feedback', 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        // Create log file with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        this.logFile = path.join(logDir, `mcp-${timestamp}.log`);
        // Set log level from env or default to INFO
        this.logLevel = LogLevel[process.env.MCP_LOG_LEVEL] || LogLevel.INFO;
        // Create write stream
        this.writeStream = fs.createWriteStream(this.logFile, { flags: 'a' });
        // Log startup
        this.info('=== MCP Server Starting ===');
        this.info(`Log file: ${this.logFile}`);
        this.info(`Log level: ${LogLevel[this.logLevel]}`);
        this.info(`Node version: ${process.version}`);
        this.info(`Process ID: ${process.pid}`);
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    log(level, message, data) {
        if (level > this.logLevel)
            return;
        const timestamp = new Date().toISOString();
        const levelStr = LogLevel[level].padEnd(5);
        const logEntry = `[${timestamp}] ${levelStr} ${message}`;
        // IMPORTANT: NO console output when running as MCP server
        // MCP uses stdio for JSON-RPC communication, any console output corrupts the protocol
        // File output only
        if (this.writeStream) {
            this.writeStream.write(logEntry);
            if (data) {
                this.writeStream.write(' ' + JSON.stringify(data, null, 2));
            }
            this.writeStream.write('\n');
        }
    }
    error(message, error) {
        const errorData = error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
        } : error;
        this.log(LogLevel.ERROR, message, errorData);
    }
    warn(message, data) {
        this.log(LogLevel.WARN, message, data);
    }
    info(message, data) {
        this.log(LogLevel.INFO, message, data);
    }
    debug(message, data) {
        this.log(LogLevel.DEBUG, message, data);
    }
    // Log unhandled errors
    setupErrorHandlers() {
        process.on('uncaughtException', (error) => {
            this.error('Uncaught Exception:', error);
            // Give time to write logs before exiting
            setTimeout(() => process.exit(1), 1000);
        });
        process.on('unhandledRejection', (reason, promise) => {
            this.error('Unhandled Rejection at:', { promise, reason });
        });
        process.on('SIGTERM', () => {
            this.info('Received SIGTERM signal, shutting down gracefully...');
            this.close();
            process.exit(0);
        });
        process.on('SIGINT', () => {
            this.info('Received SIGINT signal, shutting down gracefully...');
            this.close();
            process.exit(0);
        });
    }
    close() {
        this.info('=== MCP Server Shutting Down ===');
        if (this.writeStream) {
            this.writeStream.end();
            this.writeStream = null;
        }
    }
}
// Export singleton instance
export const logger = Logger.getInstance();
//# sourceMappingURL=logger.js.map