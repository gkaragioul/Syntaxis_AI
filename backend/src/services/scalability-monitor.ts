/**
 * Scalability Monitor
 * 
 * TDD Phase: GREEN - Minimal implementation for scalability monitoring
 * Task: 2.4 - Concurrent User Handling
 */

export interface MonitoringConfig {
  metricsInterval: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    cpuUtilization: number;
    memoryUtilization: number;
  };
}

export interface ScalabilityMetrics {
  duration: number;
  dataPoints: number;
  averageMetrics: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    cpuUtilization: number;
    memoryUtilization: number;
  };
  peakMetrics: {
    responseTime: number;
    cpuUtilization: number;
    memoryUtilization: number;
  };
  alerts: Array<{
    timestamp: Date;
    metric: string;
    value: number;
    threshold: number;
    severity: string;
  }>;
  scalabilityScore: number;
  recommendations: string[];
}

export class ScalabilityMonitor {
  private isInitialized: boolean = false;
  private isMonitoring: boolean = false;
  private monitoringConfig: MonitoringConfig | null = null;
  private metrics: Array<{
    timestamp: number;
    responseTime: number;
    throughput: number;
    errorRate: number;
    cpuUtilization: number;
    memoryUtilization: number;
  }> = [];

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async startMonitoring(config: MonitoringConfig): Promise<void> {
    this.monitoringConfig = config;
    this.isMonitoring = true;
    this.metrics = [];
  }

  async collectMetrics(duration: number): Promise<ScalabilityMetrics> {
    const dataPoints = Math.floor(duration / (this.monitoringConfig?.metricsInterval || 1000));
    
    // Simulate metric collection
    for (let i = 0; i < dataPoints; i++) {
      this.metrics.push({
        timestamp: Date.now() - (duration - (i * (this.monitoringConfig?.metricsInterval || 1000))),
        responseTime: 100 + Math.random() * 200,
        throughput: 50 + Math.random() * 30,
        errorRate: Math.random() * 0.02,
        cpuUtilization: 0.4 + Math.random() * 0.3,
        memoryUtilization: 0.5 + Math.random() * 0.2
      });
    }

    const averageMetrics = this.calculateAverageMetrics();
    const peakMetrics = this.calculatePeakMetrics();
    const alerts = this.generateAlerts();
    const scalabilityScore = this.calculateScalabilityScore(averageMetrics, peakMetrics);

    return {
      duration,
      dataPoints,
      averageMetrics,
      peakMetrics,
      alerts,
      scalabilityScore,
      recommendations: this.generateRecommendations(scalabilityScore, alerts)
    };
  }

  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    this.monitoringConfig = null;
  }

  private calculateAverageMetrics() {
    if (this.metrics.length === 0) {
      return {
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        cpuUtilization: 0,
        memoryUtilization: 0
      };
    }

    const totals = this.metrics.reduce((acc, metric) => ({
      responseTime: acc.responseTime + metric.responseTime,
      throughput: acc.throughput + metric.throughput,
      errorRate: acc.errorRate + metric.errorRate,
      cpuUtilization: acc.cpuUtilization + metric.cpuUtilization,
      memoryUtilization: acc.memoryUtilization + metric.memoryUtilization
    }), { responseTime: 0, throughput: 0, errorRate: 0, cpuUtilization: 0, memoryUtilization: 0 });

    const count = this.metrics.length;
    return {
      responseTime: totals.responseTime / count,
      throughput: totals.throughput / count,
      errorRate: totals.errorRate / count,
      cpuUtilization: totals.cpuUtilization / count,
      memoryUtilization: totals.memoryUtilization / count
    };
  }

  private calculatePeakMetrics() {
    if (this.metrics.length === 0) {
      return { responseTime: 0, cpuUtilization: 0, memoryUtilization: 0 };
    }

    return {
      responseTime: Math.max(...this.metrics.map(m => m.responseTime)),
      cpuUtilization: Math.max(...this.metrics.map(m => m.cpuUtilization)),
      memoryUtilization: Math.max(...this.metrics.map(m => m.memoryUtilization))
    };
  }

  private generateAlerts() {
    const alerts: any[] = [];
    
    if (!this.monitoringConfig) return alerts;

    this.metrics.forEach(metric => {
      if (metric.responseTime > this.monitoringConfig!.alertThresholds.responseTime) {
        alerts.push({
          timestamp: new Date(metric.timestamp),
          metric: 'responseTime',
          value: metric.responseTime,
          threshold: this.monitoringConfig!.alertThresholds.responseTime,
          severity: 'high'
        });
      }
    });

    return alerts;
  }

  private calculateScalabilityScore(averageMetrics: any, peakMetrics: any): number {
    let score = 100;

    // Deduct points for high response times
    if (averageMetrics.responseTime > 500) score -= 20;
    else if (averageMetrics.responseTime > 300) score -= 10;

    // Deduct points for high error rates
    if (averageMetrics.errorRate > 0.05) score -= 30;
    else if (averageMetrics.errorRate > 0.02) score -= 15;

    // Deduct points for high resource utilization
    if (averageMetrics.cpuUtilization > 0.8) score -= 15;
    if (averageMetrics.memoryUtilization > 0.8) score -= 15;

    return Math.max(0, score);
  }

  private generateRecommendations(score: number, alerts: any[]): string[] {
    const recommendations: string[] = [];

    if (score < 70) {
      recommendations.push('System performance is below acceptable levels');
    }

    if (alerts.length > 0) {
      recommendations.push('Address performance alerts to improve scalability');
    }

    if (score >= 80) {
      recommendations.push('System is performing well under load');
    }

    return recommendations;
  }

  async cleanup(): Promise<void> {
    this.isMonitoring = false;
    this.monitoringConfig = null;
    this.metrics = [];
    this.isInitialized = false;
  }
}

export default ScalabilityMonitor;
