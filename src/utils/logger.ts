import { LogLevel, LoggingConfig } from '../interfaces/types';

/**
 * Simple logger for Fraud Guard
 */
export class Logger {
  private level: LogLevel;
  private enableConsole: boolean;
  private levelPriority: Map<LogLevel, number>;

  constructor(config?: LoggingConfig) {
    this.level = config?.level || LogLevel.INFO;
    this.enableConsole = config?.console !== undefined ? config.console : true;

    // Level priority for filtering
    this.levelPriority = new Map([
      [LogLevel.DEBUG, 0],
      [LogLevel.INFO, 1],
      [LogLevel.WARN, 2],
      [LogLevel.ERROR, 3],
    ]);
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, message, meta);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      this.log(LogLevel.ERROR, message, {
        error: error.message,
        stack: error.stack,
      });
    } else {
      this.log(LogLevel.ERROR, message, error);
    }
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, meta?: any): void {
    // Check if this log level should be output
    const messagePriority = this.levelPriority.get(level) || 0;
    const configPriority = this.levelPriority.get(this.level) || 0;

    if (messagePriority < configPriority) {
      return; // Skip this log
    }

    if (!this.enableConsole) {
      return; // Console output disabled
    }

    // Format timestamp
    const timestamp = new Date().toISOString();

    // Format message
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [Fraud Guard]`;
    const fullMessage = `${prefix} ${message}`;

    // Output based on level
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(fullMessage, meta || '');
        break;
      case LogLevel.INFO:
        console.info(fullMessage, meta || '');
        break;
      case LogLevel.WARN:
        console.warn(fullMessage, meta || '');
        break;
      case LogLevel.ERROR:
        console.error(fullMessage, meta || '');
        break;
    }
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }
}