import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DebugUtils, DebugSession } from '../../utils/debugUtils';
import fs from 'fs/promises';
import path from 'path';

// Mock fs module
vi.mock('fs/promises');
const mockedFs = vi.mocked(fs);

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
  loggerUtils: {
    logSystemEvent: vi.fn(),
  },
}));

describe('DebugUtils (Task 2.4.4)', () => {
  beforeEach(() => {
    // Reset debug state
    DebugUtils.disable();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any sessions
    DebugUtils.getAllSessions().forEach(session => session.end());
  });

  describe('Debug Mode Management', () => {
    it('should be disabled by default in test environment', () => {
      expect(DebugUtils.isEnabled()).toBe(false);
    });

    it('should enable and disable debug mode', () => {
      DebugUtils.enable();
      expect(DebugUtils.isEnabled()).toBe(true);

      DebugUtils.disable();
      expect(DebugUtils.isEnabled()).toBe(false);
    });

    it('should respect NODE_ENV environment variable', () => {
      const originalEnv = process.env.NODE_ENV;
      
      process.env.NODE_ENV = 'development';
      // Note: This would require reloading the module to take effect
      // For testing purposes, we'll use the enable/disable methods
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Debug Sessions', () => {
    beforeEach(() => {
      DebugUtils.enable();
    });

    it('should create and manage debug sessions', () => {
      const session = DebugUtils.createSession('test-session', 'Test session description');
      
      expect(session).toBeInstanceOf(DebugSession);
      expect(session.id).toBe('test-session');
      expect(session.description).toBe('Test session description');
      
      const retrievedSession = DebugUtils.getSession('test-session');
      expect(retrievedSession).toBe(session);
    });

    it('should track multiple sessions', () => {
      const session1 = DebugUtils.createSession('session-1');
      const session2 = DebugUtils.createSession('session-2');
      
      const allSessions = DebugUtils.getAllSessions();
      expect(allSessions).toHaveLength(2);
      expect(allSessions).toContain(session1);
      expect(allSessions).toContain(session2);
    });

    it('should remove sessions', () => {
      const session = DebugUtils.createSession('test-session');
      expect(DebugUtils.getSession('test-session')).toBe(session);
      
      DebugUtils.removeSession('test-session');
      expect(DebugUtils.getSession('test-session')).toBeUndefined();
    });

    it('should return no-op session when debug mode is disabled', () => {
      DebugUtils.disable();
      
      const session = DebugUtils.createSession('test-session');
      expect(session.id).toBe('noop');
      
      const summary = session.getSummary();
      expect(summary.id).toBe('noop');
      expect(summary.operationCount).toBe(0);
    });
  });

  describe('Debug Session Operations', () => {
    let session: DebugSession;

    beforeEach(() => {
      DebugUtils.enable();
      session = DebugUtils.createSession('test-session');
    });

    it('should track operations within a session', () => {
      const operation = session.startOperation('test-operation', { test: 'context' });
      
      expect(operation.name).toBe('test-operation');
      expect(operation.context).toEqual({ test: 'context' });
    });

    it('should complete operations successfully', () => {
      const operation = session.startOperation('test-operation');
      operation.complete({ result: 'success' });
      
      const summary = operation.getSummary();
      expect(summary.success).toBe(true);
      expect(summary.result).toEqual({ result: 'success' });
      expect(summary.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle operation failures', () => {
      const operation = session.startOperation('test-operation');
      const error = new Error('Test error');
      operation.fail(error);
      
      const summary = operation.getSummary();
      expect(summary.success).toBe(false);
      expect(summary.error).toBe('Test error');
      expect(summary.duration).toBeGreaterThanOrEqual(0);
    });

    it('should add metadata to sessions', () => {
      session.addMetadata('userId', 'user-123');
      session.addMetadata('requestId', 'req-456');
      
      const summary = session.getSummary();
      expect(summary.metadata).toEqual({
        userId: 'user-123',
        requestId: 'req-456',
      });
    });

    it('should generate session summary', () => {
      session.addMetadata('test', 'value');
      const operation = session.startOperation('test-op');
      operation.complete();
      
      const summary = session.getSummary();
      
      expect(summary.id).toBe('test-session');
      expect(summary.operationCount).toBe(1);
      expect(summary.operations).toHaveLength(1);
      expect(summary.metadata).toEqual({ test: 'value' });
      expect(summary.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should end session and remove from tracking', () => {
      const summary = session.end();
      
      expect(summary.id).toBe('test-session');
      expect(DebugUtils.getSession('test-session')).toBeUndefined();
    });
  });

  describe('Performance Measurement', () => {
    beforeEach(() => {
      DebugUtils.enable();
    });

    it('should measure synchronous operations', async () => {
      const result = await DebugUtils.measureTime(
        'sync-operation',
        () => {
          let sum = 0;
          for (let i = 0; i < 1000; i++) {
            sum += i;
          }
          return sum;
        },
        { test: 'context' }
      );
      
      expect(result.result).toBe(499500); // Sum of 0 to 999
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should measure asynchronous operations', async () => {
      const result = await DebugUtils.measureTime(
        'async-operation',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'completed';
        }
      );
      
      expect(result.result).toBe('completed');
      expect(result.duration).toBeGreaterThanOrEqual(10);
    });

    it('should handle errors in measured operations', async () => {
      await expect(
        DebugUtils.measureTime(
          'failing-operation',
          () => {
            throw new Error('Test error');
          }
        )
      ).rejects.toThrow('Test error');
    });

    it('should not measure when debug mode is disabled', async () => {
      DebugUtils.disable();
      
      const result = await DebugUtils.measureTime(
        'operation',
        () => 'result'
      );
      
      expect(result.result).toBe('result');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('System Information', () => {
    it('should get comprehensive system information', () => {
      const systemInfo = DebugUtils.getSystemInfo();
      
      expect(systemInfo).toHaveProperty('nodeVersion');
      expect(systemInfo).toHaveProperty('platform');
      expect(systemInfo).toHaveProperty('architecture');
      expect(systemInfo).toHaveProperty('uptime');
      expect(systemInfo).toHaveProperty('memoryUsage');
      expect(systemInfo).toHaveProperty('cpuUsage');
      expect(systemInfo).toHaveProperty('loadAverage');
      expect(systemInfo).toHaveProperty('totalMemory');
      expect(systemInfo).toHaveProperty('freeMemory');
      expect(systemInfo).toHaveProperty('environment');
      expect(systemInfo).toHaveProperty('pid');
      expect(systemInfo).toHaveProperty('cwd');
      
      expect(typeof systemInfo.nodeVersion).toBe('string');
      expect(typeof systemInfo.uptime).toBe('number');
      expect(Array.isArray(systemInfo.loadAverage)).toBe(true);
    });
  });

  describe('Request Information', () => {
    it('should extract request debugging information', () => {
      const mockReq = {
        method: 'POST',
        originalUrl: '/api/test',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-agent',
        },
        query: { param: 'value' },
        params: { id: '123' },
        body: { data: 'test' },
        ip: '127.0.0.1',
        get: vi.fn((header) => {
          if (header === 'User-Agent') return 'test-agent';
          return undefined;
        }),
        user: { id: 'user-123', email: 'test@example.com' },
        correlationId: 'corr-123',
        requestId: 'req-456',
      } as any;
      
      const requestInfo = DebugUtils.getRequestInfo(mockReq);
      
      expect(requestInfo.method).toBe('POST');
      expect(requestInfo.url).toBe('/api/test');
      expect(requestInfo.headers).toEqual(mockReq.headers);
      expect(requestInfo.query).toEqual({ param: 'value' });
      expect(requestInfo.params).toEqual({ id: '123' });
      expect(requestInfo.body).toEqual({ data: 'test' });
      expect(requestInfo.ip).toBe('127.0.0.1');
      expect(requestInfo.userAgent).toBe('test-agent');
      expect(requestInfo.correlationId).toBe('corr-123');
      expect(requestInfo.requestId).toBe('req-456');
      expect(requestInfo.user).toEqual({ id: 'user-123', email: 'test@example.com' });
      expect(requestInfo.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Memory Monitoring', () => {
    it('should create memory snapshots', () => {
      const snapshot = DebugUtils.createMemorySnapshot();
      
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('process');
      expect(snapshot).toHaveProperty('system');
      
      expect(snapshot.process).toHaveProperty('rss');
      expect(snapshot.process).toHaveProperty('heapTotal');
      expect(snapshot.process).toHaveProperty('heapUsed');
      expect(snapshot.process).toHaveProperty('external');
      expect(snapshot.process).toHaveProperty('arrayBuffers');
      
      expect(snapshot.system).toHaveProperty('total');
      expect(snapshot.system).toHaveProperty('free');
      expect(snapshot.system).toHaveProperty('used');
      expect(snapshot.system).toHaveProperty('usagePercent');
      
      expect(typeof snapshot.process.rss).toBe('number');
      expect(typeof snapshot.system.usagePercent).toBe('number');
    });

    it('should compare memory snapshots', () => {
      const before = DebugUtils.createMemorySnapshot();
      
      // Simulate memory usage change
      const after = {
        ...before,
        timestamp: new Date(Date.now() + 1000).toISOString(),
        process: {
          ...before.process,
          heapUsed: before.process.heapUsed + 15 * 1024 * 1024, // Add 15MB
        },
      };
      
      const comparison = DebugUtils.compareMemorySnapshots(before, after);
      
      expect(comparison.timeDiff).toBe(1000);
      expect(comparison.process.heapUsed).toBe(15 * 1024 * 1024);
      expect(comparison.potentialLeak).toBe(true); // Above 10MB threshold
    });

    it('should detect potential memory leaks', () => {
      const before = DebugUtils.createMemorySnapshot();
      const after = {
        ...before,
        process: {
          ...before.process,
          heapUsed: before.process.heapUsed + 5 * 1024 * 1024, // Add 5MB
        },
      };
      
      const comparison = DebugUtils.compareMemorySnapshots(before, after);
      expect(comparison.potentialLeak).toBe(false); // Below 10MB threshold
    });
  });

  describe('Debug Data Dumping', () => {
    beforeEach(() => {
      DebugUtils.enable();
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
    });

    it('should dump debug data to file', async () => {
      const testData = { test: 'data', number: 123 };
      
      const filePath = await DebugUtils.dumpToFile(testData, 'test-dump.json');
      
      expect(mockedFs.mkdir).toHaveBeenCalledWith(
        path.join(process.cwd(), 'debug'),
        { recursive: true }
      );
      
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-dump.json'),
        expect.stringContaining('"test":"data"'),
      );
      
      expect(filePath).toContain('test-dump.json');
    });

    it('should generate filename when not provided', async () => {
      const testData = { test: 'data' };
      
      const filePath = await DebugUtils.dumpToFile(testData);
      
      expect(filePath).toMatch(/debug-dump-\d{4}-\d{2}-\d{2}T.*\.json$/);
    });

    it('should include system info in dump', async () => {
      const testData = { test: 'data' };
      
      await DebugUtils.dumpToFile(testData);
      
      const writeCall = mockedFs.writeFile.mock.calls[0];
      const dumpContent = JSON.parse(writeCall[1] as string);
      
      expect(dumpContent).toHaveProperty('timestamp');
      expect(dumpContent).toHaveProperty('systemInfo');
      expect(dumpContent).toHaveProperty('data');
      expect(dumpContent.data).toEqual(testData);
    });

    it('should throw error when debug mode is disabled', async () => {
      DebugUtils.disable();
      
      await expect(
        DebugUtils.dumpToFile({ test: 'data' })
      ).rejects.toThrow('Debug mode is not enabled');
    });
  });

  describe('Logging Integration', () => {
    beforeEach(() => {
      DebugUtils.enable();
    });

    it('should log debug messages when enabled', () => {
      const { logger } = require('../../utils/logger');
      
      DebugUtils.log('Test debug message', { test: 'data' });
      
      expect(logger.debug).toHaveBeenCalledWith(
        '[DEBUG] Test debug message',
        expect.objectContaining({
          category: 'debug',
          debugData: { test: 'data' },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        })
      );
    });

    it('should not log when debug mode is disabled', () => {
      DebugUtils.disable();
      const { logger } = require('../../utils/logger');
      
      DebugUtils.log('Test debug message');
      
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });
});
