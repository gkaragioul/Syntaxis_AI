import { Request, Response } from 'express';
import { logger, loggerUtils } from './logger';
import { performance } from 'perf_hooks';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

// Debug utilities for development environment
export class DebugUtils {
  private static isDebugMode = process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true';
  private static debugSessions = new Map<string, DebugSession>();

  /**
   * Check if debug mode is enabled
   */
  static isEnabled(): boolean {
    return this.isDebugMode;
  }

  /**
   * Enable debug mode (for testing)
   */
  static enable(): void {
    this.isDebugMode = true;
  }

  /**
   * Disable debug mode
   */
  static disable(): void {
    this.isDebugMode = false;
  }

  /**
   * Create a debug session for tracking operations
   */
  static createSession(sessionId: string, description?: string): DebugSession {
    if (!this.isEnabled()) {
      return new NoOpDebugSession();
    }

    const session = new DebugSession(sessionId, description);
    this.debugSessions.set(sessionId, session);
    return session;
  }

  /**
   * Get an existing debug session
   */
  static getSession(sessionId: string): DebugSession | undefined {
    return this.debugSessions.get(sessionId);
  }

  /**
   * Remove a debug session
   */
  static removeSession(sessionId: string): void {
    this.debugSessions.delete(sessionId);
  }

  /**
   * Get all active debug sessions
   */
  static getAllSessions(): DebugSession[] {
    return Array.from(this.debugSessions.values());
  }

  /**
   * Log debug information
   */
  static log(message: string, data?: any): void {
    if (!this.isEnabled()) return;

    logger.debug(`[DEBUG] ${message}`, {
      category: 'debug',
      debugData: data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(
    operation: string,
    fn: () => Promise<T> | T,
    context?: any
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      if (this.isEnabled()) {
        this.log(`Operation "${operation}" completed`, {
          duration: `${duration.toFixed(2)}ms`,
          ...context,
        });
      }
      
      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;
      
      if (this.isEnabled()) {
        this.log(`Operation "${operation}" failed`, {
          duration: `${duration.toFixed(2)}ms`,
          error: error instanceof Error ? error.message : String(error),
          ...context,
        });
      }
      
      throw error;
    }
  }

  /**
   * Get system information for debugging
   */
  static getSystemInfo(): SystemInfo {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      loadAverage: os.loadavg(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      networkInterfaces: os.networkInterfaces(),
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
      cwd: process.cwd(),
    };
  }

  /**
   * Get request debugging information
   */
  static getRequestInfo(req: Request): RequestDebugInfo {
    return {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: (req as any).correlationId,
      requestId: (req as any).requestId,
      user: req.user ? { id: req.user.id, email: req.user.email } : undefined,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Dump debug information to file
   */
  static async dumpToFile(data: any, filename?: string): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Debug mode is not enabled');
    }

    const debugDir = path.join(process.cwd(), 'debug');
    await fs.mkdir(debugDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = filename || `debug-dump-${timestamp}.json`;
    const filePath = path.join(debugDir, fileName);

    const debugData = {
      timestamp: new Date().toISOString(),
      systemInfo: this.getSystemInfo(),
      data,
    };

    await fs.writeFile(filePath, JSON.stringify(debugData, null, 2));
    
    this.log(`Debug data dumped to file`, { filePath });
    return filePath;
  }

  /**
   * Create a memory snapshot for debugging memory leaks
   */
  static createMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const systemMem = {
      total: os.totalmem(),
      free: os.freemem(),
    };

    return {
      timestamp: new Date().toISOString(),
      process: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
      },
      system: {
        total: systemMem.total,
        free: systemMem.free,
        used: systemMem.total - systemMem.free,
        usagePercent: ((systemMem.total - systemMem.free) / systemMem.total) * 100,
      },
    };
  }

  /**
   * Compare memory snapshots to detect leaks
   */
  static compareMemorySnapshots(before: MemorySnapshot, after: MemorySnapshot): MemoryComparison {
    const processDiff = {
      rss: after.process.rss - before.process.rss,
      heapTotal: after.process.heapTotal - before.process.heapTotal,
      heapUsed: after.process.heapUsed - before.process.heapUsed,
      external: after.process.external - before.process.external,
      arrayBuffers: after.process.arrayBuffers - before.process.arrayBuffers,
    };

    const systemDiff = {
      used: after.system.used - before.system.used,
      usagePercent: after.system.usagePercent - before.system.usagePercent,
    };

    return {
      timeDiff: new Date(after.timestamp).getTime() - new Date(before.timestamp).getTime(),
      process: processDiff,
      system: systemDiff,
      potentialLeak: processDiff.heapUsed > 10 * 1024 * 1024, // 10MB threshold
    };
  }
}

/**
 * Debug session for tracking operations
 */
export class DebugSession {
  private startTime: number;
  private operations: DebugOperation[] = [];
  private metadata: Record<string, any> = {};

  constructor(
    public readonly id: string,
    public readonly description?: string
  ) {
    this.startTime = performance.now();
    DebugUtils.log(`Debug session started: ${id}`, { description });
  }

  /**
   * Add metadata to the session
   */
  addMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  /**
   * Start tracking an operation
   */
  startOperation(name: string, context?: any): DebugOperation {
    const operation = new DebugOperation(name, context);
    this.operations.push(operation);
    return operation;
  }

  /**
   * Get session summary
   */
  getSummary(): DebugSessionSummary {
    const now = performance.now();
    const totalDuration = now - this.startTime;

    return {
      id: this.id,
      description: this.description,
      startTime: this.startTime,
      totalDuration,
      operationCount: this.operations.length,
      operations: this.operations.map(op => op.getSummary()),
      metadata: this.metadata,
    };
  }

  /**
   * End the session and log summary
   */
  end(): DebugSessionSummary {
    const summary = this.getSummary();
    DebugUtils.log(`Debug session ended: ${this.id}`, summary);
    DebugUtils.removeSession(this.id);
    return summary;
  }
}

/**
 * No-op debug session for when debug mode is disabled
 */
class NoOpDebugSession extends DebugSession {
  constructor() {
    super('noop');
  }

  addMetadata(): void {}
  startOperation(): DebugOperation {
    return new NoOpDebugOperation();
  }
  getSummary(): DebugSessionSummary {
    return {
      id: 'noop',
      startTime: 0,
      totalDuration: 0,
      operationCount: 0,
      operations: [],
      metadata: {},
    };
  }
  end(): DebugSessionSummary {
    return this.getSummary();
  }
}

/**
 * Debug operation for tracking individual operations within a session
 */
export class DebugOperation {
  private startTime: number;
  private endTime?: number;
  private error?: Error;
  private result?: any;

  constructor(
    public readonly name: string,
    public readonly context?: any
  ) {
    this.startTime = performance.now();
  }

  /**
   * Mark operation as completed
   */
  complete(result?: any): void {
    this.endTime = performance.now();
    this.result = result;
  }

  /**
   * Mark operation as failed
   */
  fail(error: Error): void {
    this.endTime = performance.now();
    this.error = error;
  }

  /**
   * Get operation summary
   */
  getSummary(): DebugOperationSummary {
    return {
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime ? this.endTime - this.startTime : undefined,
      success: !this.error,
      error: this.error?.message,
      context: this.context,
      result: this.result,
    };
  }
}

/**
 * No-op debug operation
 */
class NoOpDebugOperation extends DebugOperation {
  constructor() {
    super('noop');
  }

  complete(): void {}
  fail(): void {}
  getSummary(): DebugOperationSummary {
    return {
      name: 'noop',
      startTime: 0,
      success: true,
    };
  }
}

// Type definitions
export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  architecture: string;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  loadAverage: number[];
  totalMemory: number;
  freeMemory: number;
  networkInterfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>;
  environment: string;
  pid: number;
  cwd: string;
}

export interface RequestDebugInfo {
  method: string;
  url: string;
  headers: any;
  query: any;
  params: any;
  body: any;
  ip: string;
  userAgent?: string;
  correlationId?: string;
  requestId?: string;
  user?: { id: string; email: string };
  timestamp: string;
}

export interface MemorySnapshot {
  timestamp: string;
  process: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  system: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
}

export interface MemoryComparison {
  timeDiff: number;
  process: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  system: {
    used: number;
    usagePercent: number;
  };
  potentialLeak: boolean;
}

export interface DebugSessionSummary {
  id: string;
  description?: string;
  startTime: number;
  totalDuration: number;
  operationCount: number;
  operations: DebugOperationSummary[];
  metadata: Record<string, any>;
}

export interface DebugOperationSummary {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  context?: any;
  result?: any;
}

export default DebugUtils;
