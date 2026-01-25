import * as fs from 'fs';
import path from 'path';
import { getLogsPath } from './utils';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private logFile: string;
  private maxLogSize = 10 * 1024 * 1024; // 10MB
  private maxLogFiles = 5;

  constructor() {
    const logsPath = getLogsPath();
    this.logFile = path.join(logsPath, 'app.log');
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, data } = entry;
    let logLine = `[${timestamp}] [${level}] ${message}`;
    if (data) {
      logLine += ` ${JSON.stringify(data)}`;
    }
    return logLine;
  }

  private rotateLogIfNeeded(): void {
    try {
      if (!fs.existsSync(this.logFile)) {
        return;
      }

      const stats = fs.statSync(this.logFile);
      if (stats.size > this.maxLogSize) {
        const logsPath = getLogsPath();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(logsPath, `app.log.${timestamp}`);
        fs.renameSync(this.logFile, backupFile);

        // Clean up old log files
        const files = fs.readdirSync(logsPath)
          .filter(f => f.startsWith('app.log.'))
          .sort()
          .reverse();

        for (let i = this.maxLogFiles; i < files.length; i++) {
          fs.unlinkSync(path.join(logsPath, files[i]));
        }
      }
    } catch (error) {
      console.error('Error rotating log file:', error);
    }
  }

  private writeToFile(entry: LogEntry): void {
    try {
      this.rotateLogIfNeeded();
      const logLine = this.formatLogEntry(entry);
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf-8');
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      data,
    };

    const logLine = this.formatLogEntry(entry);
    console.log(logLine);
    this.writeToFile(entry);
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: any): void {
    const errorData = error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
        }
      : error;
    this.log(LogLevel.ERROR, message, errorData);
  }

  getLogFile(): string {
    return this.logFile;
  }
}

export const logger = new Logger();

