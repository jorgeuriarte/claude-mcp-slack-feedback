import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export class Logger {
  private static instance: Logger;
  private logFile: string;
  private logLevel: LogLevel;
  private writeStream: fs.WriteStream | null = null;

  private constructor() {
    // Create logs directory
    const logDir = path.join(homedir(), '.claude-mcp-slack-feedback', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    this.logFile = path.join(logDir, `mcp-${timestamp}.log`);
    
    // Set log level from env or default to INFO
    this.logLevel = LogLevel[process.env.MCP_LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO;
    
    // Create write stream
    this.writeStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    
    // Log startup
    this.info('=== MCP Server Starting ===');
    this.info(`Log file: ${this.logFile}`);
    this.info(`Log level: ${LogLevel[this.logLevel]}`);
    this.info(`Node version: ${process.version}`);
    this.info(`Process ID: ${process.pid}`);
    
    // Log debug mode status
    const debugVars = ['MCP_DEBUG', 'CLAUDE_DEBUG', 'MCP_CLAUDE_DEBUG', 'DEBUG'];
    const activeDebug = debugVars.find(v => 
      process.env[v] === '1' || process.env[v] === 'true' || process.env[v] === '*'
    );
    if (activeDebug) {
      this.info(`Debug mode: ENABLED via ${activeDebug}=${process.env[activeDebug]} (writing to stderr)`);
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (level > this.logLevel) return;

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level].padEnd(5);
    const logEntry = `[${timestamp}] ${levelStr} ${message}`;
    
    // IMPORTANT: NO console output when running as MCP server
    // MCP uses stdio for JSON-RPC communication, any console output corrupts the protocol
    // EXCEPT when MCP_DEBUG is set, then we write to stderr for debugging
    
    // Check if we're in debug mode (various ways to enable it)
    const isDebugMode = process.env.MCP_DEBUG === '1' || 
                        process.env.MCP_DEBUG === 'true' ||
                        process.env.CLAUDE_DEBUG === '1' || 
                        process.env.CLAUDE_DEBUG === 'true' ||
                        process.env.MCP_CLAUDE_DEBUG === 'true' ||
                        process.env.DEBUG === 'true' ||
                        process.env.DEBUG === '*';
    
    if (isDebugMode) {
      // Write to stderr when in debug mode
      process.stderr.write(logEntry);
      if (data) {
        process.stderr.write(' ' + JSON.stringify(data, null, 2));
      }
      process.stderr.write('\n');
    }
    
    // Always write to file
    if (this.writeStream) {
      this.writeStream.write(logEntry);
      if (data) {
        this.writeStream.write(' ' + JSON.stringify(data, null, 2));
      }
      this.writeStream.write('\n');
    }
  }

  error(message: string, error?: Error | any) {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error;
    this.log(LogLevel.ERROR, message, errorData);
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data);
  }

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data);
  }

  debug(message: string, data?: any) {
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