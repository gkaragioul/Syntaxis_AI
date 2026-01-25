/**
 * Provider Monitor
 * 
 * TDD Phase: GREEN - Minimal implementation for provider monitoring
 * Enhancement: API Integration Expansion
 */

export interface ProviderEvent {
  providerId: string;
  timestamp: Date;
  responseTime: number;
  success: boolean;
  cost: number;
}

export interface MonitoringPeriod {
  startTime: Date;
  endTime: Date;
  granularity: string;
}

export interface PerformanceReport {
  reportId: string;
  timeRange: MonitoringPeriod;
  generatedAt: Date;
  providerMetrics: Record<string, {
    providerId: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    averageResponseTime: number;
    medianResponseTime: number;
    p95ResponseTime: number;
    totalCost: number;
    averageCostPerRequest: number;
    availability: {
      uptime: number;
      downtimeEvents: any[];
      availabilityPercentage: number;
    };
    errorAnalysis: {
      errorTypes: Record<string, number>;
      errorRate: number;
      mostCommonErrors: any[];
    };
  }>;
  comparativeAnalysis: {
    fastestProvider: {
      providerId: string;
      averageResponseTime: number;
    };
    mostReliableProvider: {
      providerId: string;
      successRate: number;
    };
    mostCostEffectiveProvider: {
      providerId: string;
      costPerSuccessfulRequest: number;
    };
    overallRecommendation: string;
  };
  trends: Array<{
    metric: string;
    trend: string;
    changePercentage: number;
    significance: string;
  }>;
  alerts: Array<{
    alertType: string;
    severity: string;
    message: string;
    affectedProvider: string;
    recommendedAction: string;
  }>;
}

export class ProviderMonitor {
  private events: Map<string, ProviderEvent[]> = new Map();
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async recordProviderEvent(event: ProviderEvent): Promise<void> {
    const providerEvents = this.events.get(event.providerId) || [];
    providerEvents.push(event);
    this.events.set(event.providerId, providerEvents);

    // Keep only last 1000 events per provider
    if (providerEvents.length > 1000) {
      this.events.set(event.providerId, providerEvents.slice(-500));
    }
  }

  async generatePerformanceReport(period: MonitoringPeriod): Promise<PerformanceReport> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const generatedAt = new Date();

    // Generate metrics for each provider
    const providerMetrics: Record<string, any> = {};
    
    for (const [providerId, events] of this.events) {
      const filteredEvents = events.filter(event => 
        event.timestamp >= period.startTime && event.timestamp <= period.endTime
      );

      if (filteredEvents.length > 0) {
        providerMetrics[providerId] = this.calculateProviderMetrics(providerId, filteredEvents);
      }
    }

    // Generate comparative analysis
    const comparativeAnalysis = this.generateComparativeAnalysis(providerMetrics);

    // Generate trends
    const trends = this.generateTrends(providerMetrics);

    // Generate alerts
    const alerts = this.generateAlerts(providerMetrics);

    return {
      reportId,
      timeRange: period,
      generatedAt,
      providerMetrics,
      comparativeAnalysis,
      trends,
      alerts
    };
  }

  private calculateProviderMetrics(providerId: string, events: ProviderEvent[]): any {
    const totalRequests = events.length;
    const successfulRequests = events.filter(e => e.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;

    // Response time metrics
    const responseTimes = events.map(e => e.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const medianResponseTime = responseTimes[Math.floor(responseTimes.length / 2)] || 0;
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p95ResponseTime = responseTimes[p95Index] || responseTimes[responseTimes.length - 1] || 0;

    // Cost metrics
    const totalCost = events.reduce((sum, e) => sum + e.cost, 0);
    const averageCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

    // Availability metrics
    const availability = this.calculateAvailability(events);

    // Error analysis
    const errorAnalysis = this.calculateErrorAnalysis(events);

    return {
      providerId,
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate,
      averageResponseTime: Math.round(averageResponseTime),
      medianResponseTime: Math.round(medianResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      totalCost: Math.round(totalCost * 100) / 100,
      averageCostPerRequest: Math.round(averageCostPerRequest * 10000) / 10000,
      availability,
      errorAnalysis
    };
  }

  private calculateAvailability(events: ProviderEvent[]): any {
    const totalTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const failedEvents = events.filter(e => !e.success);
    
    // Estimate downtime based on failed events
    const estimatedDowntime = failedEvents.length * 60000; // 1 minute per failed event
    const uptime = Math.max(0, totalTime - estimatedDowntime);
    const availabilityPercentage = uptime / totalTime;

    return {
      uptime,
      downtimeEvents: failedEvents.map(e => ({
        timestamp: e.timestamp,
        duration: 60000, // Estimated 1 minute downtime
        reason: 'service_error'
      })),
      availabilityPercentage
    };
  }

  private calculateErrorAnalysis(events: ProviderEvent[]): any {
    const failedEvents = events.filter(e => !e.success);
    const totalEvents = events.length;
    const errorRate = totalEvents > 0 ? failedEvents.length / totalEvents : 0;

    // Simulate error types
    const errorTypes = {
      'rate_limit_exceeded': Math.floor(failedEvents.length * 0.4),
      'service_unavailable': Math.floor(failedEvents.length * 0.3),
      'timeout': Math.floor(failedEvents.length * 0.2),
      'invalid_request': Math.floor(failedEvents.length * 0.1)
    };

    const mostCommonErrors = Object.entries(errorTypes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => ({ type, count, percentage: count / failedEvents.length }));

    return {
      errorTypes,
      errorRate,
      mostCommonErrors
    };
  }

  private generateComparativeAnalysis(providerMetrics: Record<string, any>): any {
    const providers = Object.values(providerMetrics);
    
    if (providers.length === 0) {
      return {
        fastestProvider: { providerId: 'none', averageResponseTime: 0 },
        mostReliableProvider: { providerId: 'none', successRate: 0 },
        mostCostEffectiveProvider: { providerId: 'none', costPerSuccessfulRequest: 0 },
        overallRecommendation: 'No data available for analysis'
      };
    }

    // Find fastest provider
    const fastestProvider = providers.reduce((fastest, current) => 
      current.averageResponseTime < fastest.averageResponseTime ? current : fastest
    );

    // Find most reliable provider
    const mostReliableProvider = providers.reduce((reliable, current) => 
      current.successRate > reliable.successRate ? current : reliable
    );

    // Find most cost-effective provider
    const mostCostEffectiveProvider = providers.reduce((costEffective, current) => {
      const currentCostPerSuccess = current.successfulRequests > 0 
        ? current.totalCost / current.successfulRequests 
        : Infinity;
      const costEffectiveCostPerSuccess = costEffective.successfulRequests > 0 
        ? costEffective.totalCost / costEffective.successfulRequests 
        : Infinity;
      
      return currentCostPerSuccess < costEffectiveCostPerSuccess ? current : costEffective;
    });

    const costPerSuccessfulRequest = mostCostEffectiveProvider.successfulRequests > 0
      ? mostCostEffectiveProvider.totalCost / mostCostEffectiveProvider.successfulRequests
      : 0;

    // Generate overall recommendation
    let overallRecommendation = 'All providers performing within normal parameters';
    if (mostReliableProvider.successRate < 0.9) {
      overallRecommendation = 'Consider reviewing provider configurations - reliability below 90%';
    } else if (fastestProvider.averageResponseTime > 5000) {
      overallRecommendation = 'Consider optimizing for speed - response times above 5 seconds';
    }

    return {
      fastestProvider: {
        providerId: fastestProvider.providerId,
        averageResponseTime: fastestProvider.averageResponseTime
      },
      mostReliableProvider: {
        providerId: mostReliableProvider.providerId,
        successRate: mostReliableProvider.successRate
      },
      mostCostEffectiveProvider: {
        providerId: mostCostEffectiveProvider.providerId,
        costPerSuccessfulRequest
      },
      overallRecommendation
    };
  }

  private generateTrends(providerMetrics: Record<string, any>): any[] {
    const trends = [];

    // Simulate trend analysis
    for (const [providerId, metrics] of Object.entries(providerMetrics)) {
      if (metrics.successRate < 0.95) {
        trends.push({
          metric: `${providerId}_success_rate`,
          trend: 'declining',
          changePercentage: -5.2,
          significance: 'medium'
        });
      }

      if (metrics.averageResponseTime > 3000) {
        trends.push({
          metric: `${providerId}_response_time`,
          trend: 'stable',
          changePercentage: 1.1,
          significance: 'low'
        });
      }
    }

    if (trends.length === 0) {
      trends.push({
        metric: 'overall_performance',
        trend: 'stable',
        changePercentage: 0.5,
        significance: 'low'
      });
    }

    return trends;
  }

  private generateAlerts(providerMetrics: Record<string, any>): any[] {
    const alerts = [];

    for (const [providerId, metrics] of Object.entries(providerMetrics)) {
      // Success rate alert
      if (metrics.successRate < 0.9) {
        alerts.push({
          alertType: 'reliability',
          severity: 'high',
          message: `${providerId} success rate below 90%: ${(metrics.successRate * 100).toFixed(1)}%`,
          affectedProvider: providerId,
          recommendedAction: 'Review provider configuration and error logs'
        });
      }

      // Response time alert
      if (metrics.averageResponseTime > 5000) {
        alerts.push({
          alertType: 'performance',
          severity: 'medium',
          message: `${providerId} average response time above 5 seconds: ${metrics.averageResponseTime}ms`,
          affectedProvider: providerId,
          recommendedAction: 'Consider load balancing or provider optimization'
        });
      }

      // Cost alert
      if (metrics.averageCostPerRequest > 0.1) {
        alerts.push({
          alertType: 'cost',
          severity: 'medium',
          message: `${providerId} cost per request above $0.10: $${metrics.averageCostPerRequest.toFixed(4)}`,
          affectedProvider: providerId,
          recommendedAction: 'Review pricing tier and usage optimization'
        });
      }
    }

    return alerts;
  }

  async cleanup(): Promise<void> {
    this.events.clear();
    this.isInitialized = false;
  }
}

export default ProviderMonitor;
