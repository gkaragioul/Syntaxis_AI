import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import { loggerUtils } from './logger';

/**
 * Performance monitoring utility for tracking application performance
 */
export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor;
  private observer: PerformanceObserver | null = null;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private isEnabled: boolean = false;
  private thresholds: PerformanceThresholds = {
    slow: 1000, // 1 second
    critical: 5000, // 5 seconds
  };

  private constructor() {
    super();
    this.setupPerformanceObserver();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Enable performance monitoring
   */
  enable(): void {
    this.isEnabled = true;
    if (this.observer) {
      this.observer.observe({
        entryTypes: ['measure', 'mark', 'resource'] as any,
      });
    }
    loggerUtils.logSystemEvent('Performance monitoring enabled', 'info');
  }

  /**
   * Disable performance monitoring
   */
  disable(): void {
    this.isEnabled = false;
    if (this.observer) {
      this.observer.disconnect();
    }
    loggerUtils.logSystemEvent('Performance monitoring disabled', 'info');
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Start measuring an operation
   */
  startMeasure(name: string, context?: any): PerformanceMeasurement {
    if (!this.isEnabled) {
      return new NoOpPerformanceMeasurement();
    }

    const startMark = `${name}-start-${Date.now()}`;
    performance.mark(startMark);

    return new PerformanceMeasurement(name, startMark, context, this);
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    if (!this.isEnabled) return;

    const metrics = this.metrics.get(metric.name) || [];
    metrics.push(metric);

    // Keep only last 100 metrics per operation
    if (metrics.length > 100) {
      metrics.shift();
    }

    this.metrics.set(metric.name, metrics);

    // Check thresholds and emit events
    this.checkThresholds(metric);

    // Log performance metric
    loggerUtils.logPerformance(metric.name, metric.duration, 'ms', {
      context: metric.context,
      threshold: this.getThresholdLevel(metric.duration),
    });
  }

  /**
   * Get performance statistics for an operation
   */
  getStats(operationName: string): PerformanceStats | null {
    const metrics = this.metrics.get(operationName);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const durations = metrics.map((m) => m.duration);
    const sorted = durations.sort((a, b) => a - b);

    return {
      operationName,
      count: metrics.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      slowCount: durations.filter((d) => d > this.thresholds.slow).length,
      criticalCount: durations.filter((d) => d > this.thresholds.critical)
        .length,
      recentMetrics: metrics.slice(-10), // Last 10 metrics
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): PerformanceStats[] {
    return Array.from(this.metrics.keys())
      .map((name) => this.getStats(name))
      .filter((stats) => stats !== null) as PerformanceStats[];
  }

  /**
   * Clear metrics for an operation
   */
  clearMetrics(operationName?: string): void {
    if (operationName) {
      this.metrics.delete(operationName);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): MemoryUsageInfo {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      heapUsedPercent: (usage.heapUsed / usage.heapTotal) * 100,
    };
  }

  /**
   * Get CPU usage information
   */
  getCpuUsage(): CpuUsageInfo {
    const usage = process.cpuUsage();
    return {
      user: usage.user / 1000000, // Convert to seconds
      system: usage.system / 1000000,
      total: (usage.user + usage.system) / 1000000,
    };
  }

  /**
   * Create a performance report
   */
  createReport(): PerformanceReport {
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: this.getMemoryUsage(),
      cpu: this.getCpuUsage(),
      operations: this.getAllStats(),
      thresholds: this.thresholds,
    };
  }

  private setupPerformanceObserver(): void {
    try {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'measure') {
            // Handle custom measurements
            this.handleMeasureEntry(entry);
          }
        });
      });
    } catch (error) {
      loggerUtils.logError(error as Error, {
        context: 'PerformanceObserver setup',
      });
    }
  }

  private handleMeasureEntry(entry: any): void {
    // Extract operation name from measure name
    const operationName = entry.name.replace(/-measure-\d+$/, '');

    const metric: PerformanceMetric = {
      name: operationName,
      duration: entry.duration,
      timestamp: new Date().toISOString(),
      startTime: entry.startTime,
    };

    this.recordMetric(metric);
  }

  private checkThresholds(metric: PerformanceMetric): void {
    if (metric.duration > this.thresholds.critical) {
      this.emit('critical', metric);
    } else if (metric.duration > this.thresholds.slow) {
      this.emit('slow', metric);
    }
  }

  private getThresholdLevel(duration: number): string {
    if (duration > this.thresholds.critical) return 'critical';
    if (duration > this.thresholds.slow) return 'slow';
    return 'normal';
  }
}

/**
 * Performance measurement class
 */
export class PerformanceMeasurement {
  private endMark?: string;

  constructor(
    private name: string,
    private startMark: string,
    private context?: any,
    private monitor?: PerformanceMonitor,
  ) {}

  /**
   * End the measurement
   */
  end(): PerformanceResult {
    this.endMark = `${this.name}-end-${Date.now()}`;
    performance.mark(this.endMark);

    const measureName = `${this.name}-measure-${Date.now()}`;
    performance.measure(measureName, this.startMark, this.endMark);

    const measure = performance.getEntriesByName(measureName)[0];
    const duration = measure.duration;

    const metric: PerformanceMetric = {
      name: this.name,
      duration,
      timestamp: new Date().toISOString(),
      startTime: measure.startTime,
      context: this.context,
    };

    if (this.monitor) {
      this.monitor.recordMetric(metric);
    }

    // Clean up marks and measures
    performance.clearMarks(this.startMark);
    performance.clearMarks(this.endMark);
    performance.clearMeasures(measureName);

    return {
      name: this.name,
      duration,
      context: this.context,
    };
  }
}

/**
 * No-op performance measurement for when monitoring is disabled
 */
class NoOpPerformanceMeasurement extends PerformanceMeasurement {
  constructor() {
    super('noop', 'noop');
  }

  end(): PerformanceResult {
    return {
      name: 'noop',
      duration: 0,
    };
  }
}

// Type definitions
export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: string;
  startTime: number;
  context?: any;
}

export interface PerformanceStats {
  operationName: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
  slowCount: number;
  criticalCount: number;
  recentMetrics: PerformanceMetric[];
}

export interface PerformanceThresholds {
  slow: number;
  critical: number;
}

export interface PerformanceResult {
  name: string;
  duration: number;
  context?: any;
}

export interface MemoryUsageInfo {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  heapUsedPercent: number;
}

export interface CpuUsageInfo {
  user: number;
  system: number;
  total: number;
}

export interface PerformanceReport {
  timestamp: string;
  uptime: number;
  memory: MemoryUsageInfo;
  cpu: CpuUsageInfo;
  operations: PerformanceStats[];
  thresholds: PerformanceThresholds;
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Utility functions
export const measureAsync = async <T>(
  name: string,
  fn: () => Promise<T>,
  context?: any,
): Promise<{ result: T; duration: number }> => {
  const measurement = performanceMonitor.startMeasure(name, context);
  try {
    const result = await fn();
    const { duration } = measurement.end();
    return { result, duration };
  } catch (error) {
    measurement.end();
    throw error;
  }
};

export const measureSync = <T>(
  name: string,
  fn: () => T,
  context?: any,
): { result: T; duration: number } => {
  const measurement = performanceMonitor.startMeasure(name, context);
  try {
    const result = fn();
    const { duration } = measurement.end();
    return { result, duration };
  } catch (error) {
    measurement.end();
    throw error;
  }
};

export default performanceMonitor;
