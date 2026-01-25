/**
 * Metrics Collector
 * 
 * TDD Phase: GREEN - Minimal implementation for metrics collection
 * Enhancement: Advanced Analytics Dashboard
 */

export interface ProcessingEvent {
  type: string;
  timestamp: Date;
  userId: string;
  fileSize?: number;
  documentType?: string;
  processingTime?: number;
  errorType?: string;
}

export interface DailyMetrics {
  date: Date;
  documentsProcessed: number;
  successRate: number;
  averageProcessingTime: number;
  activeUsers: number;
  errorCount: number;
}

export interface MetricsData {
  timestamp: Date;
  processing_time: number;
  success_rate: number;
  user_activity: number;
  system_load: number;
}

export class MetricsCollector {
  private events: ProcessingEvent[] = [];
  private dailyMetrics: DailyMetrics[] = [];
  private metricsData: MetricsData[] = [];
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async recordEvent(event: ProcessingEvent): Promise<void> {
    this.events.push({
      ...event,
      timestamp: event.timestamp || new Date()
    });

    // Keep only last 10000 events
    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000);
    }
  }

  async recordDailyMetrics(metrics: DailyMetrics): Promise<void> {
    this.dailyMetrics.push(metrics);

    // Keep only last 365 days
    if (this.dailyMetrics.length > 365) {
      this.dailyMetrics = this.dailyMetrics.slice(-180);
    }
  }

  async recordMetrics(metrics: MetricsData): Promise<void> {
    this.metricsData.push(metrics);

    // Keep only last 1000 data points
    if (this.metricsData.length > 1000) {
      this.metricsData = this.metricsData.slice(-500);
    }
  }

  async getEvents(timeRange?: { start: Date; end: Date }): Promise<ProcessingEvent[]> {
    if (!timeRange) {
      return [...this.events];
    }

    return this.events.filter(event => 
      event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
    );
  }

  async getDailyMetrics(timeRange?: { start: Date; end: Date }): Promise<DailyMetrics[]> {
    if (!timeRange) {
      return [...this.dailyMetrics];
    }

    return this.dailyMetrics.filter(metrics => 
      metrics.date >= timeRange.start && metrics.date <= timeRange.end
    );
  }

  async getMetricsData(): Promise<MetricsData[]> {
    return [...this.metricsData];
  }

  async cleanup(): Promise<void> {
    this.events = [];
    this.dailyMetrics = [];
    this.metricsData = [];
    this.isInitialized = false;
  }
}

export default MetricsCollector;
