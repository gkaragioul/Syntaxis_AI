/**
 * Advanced Analytics Dashboard Tests
 * 
 * TDD Phase: RED - These tests should fail initially
 * Enhancement: Advanced Analytics Dashboard
 * 
 * Following strict TDD methodology with extreme modularity:
 * 
 * Requirements:
 * - Real-time processing metrics and trends visualization
 * - User activity analytics and insights
 * - System performance monitoring and alerts
 * - Business intelligence reporting
 * - Predictive analytics for capacity planning
 * 
 * This implements comprehensive analytics with interactive dashboards.
 */

import { AnalyticsDashboard } from '../../services/analytics/analytics-dashboard';
import { MetricsCollector } from '../../services/analytics/metrics-collector';
import { TrendAnalyzer } from '../../services/analytics/trend-analyzer';
import { ReportGenerator } from '../../services/analytics/report-generator';
import { PredictiveAnalytics } from '../../services/analytics/predictive-analytics';
import { AlertManager } from '../../services/analytics/alert-manager';
import { TestEnvironment } from '../utils/test-environment';
import { jest } from '@jest/globals';

describe('Advanced Analytics Dashboard - TDD Implementation', () => {
  let testEnv: TestEnvironment;
  let analyticsDashboard: AnalyticsDashboard;
  let metricsCollector: MetricsCollector;
  let trendAnalyzer: TrendAnalyzer;
  let reportGenerator: ReportGenerator;
  let predictiveAnalytics: PredictiveAnalytics;
  let alertManager: AlertManager;

  beforeAll(async () => {
    testEnv = TestEnvironment.getInstance();
    await testEnv.setup();
  });

  beforeEach(async () => {
    await testEnv.reset();
    
    // RED: These should fail - we need advanced analytics infrastructure
    analyticsDashboard = new AnalyticsDashboard();
    metricsCollector = new MetricsCollector();
    trendAnalyzer = new TrendAnalyzer();
    reportGenerator = new ReportGenerator();
    predictiveAnalytics = new PredictiveAnalytics();
    alertManager = new AlertManager();

    await analyticsDashboard.initialize();
    await metricsCollector.initialize();
    await trendAnalyzer.initialize();
    await reportGenerator.initialize();
    await predictiveAnalytics.initialize();
    await alertManager.initialize();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  describe('Real-time Processing Metrics', () => {
    it('should collect and display real-time processing metrics', async () => {
      // RED: This test should fail - real-time metrics collection not implemented
      const metricsTimeframe = {
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        endTime: new Date(),
        granularity: 'minute' as const
      };

      // Simulate processing events
      const processingEvents = [
        { type: 'document_uploaded', timestamp: new Date(Date.now() - 3000000), userId: 'user_1', fileSize: 1024000 },
        { type: 'processing_started', timestamp: new Date(Date.now() - 2900000), userId: 'user_1', documentType: 'invoice' },
        { type: 'processing_completed', timestamp: new Date(Date.now() - 2800000), userId: 'user_1', processingTime: 15000 },
        { type: 'document_uploaded', timestamp: new Date(Date.now() - 2700000), userId: 'user_2', fileSize: 2048000 },
        { type: 'processing_failed', timestamp: new Date(Date.now() - 2600000), userId: 'user_2', errorType: 'API_RATE_LIMIT' }
      ];

      for (const event of processingEvents) {
        await metricsCollector.recordEvent(event);
      }

      const realTimeMetrics = await analyticsDashboard.getRealTimeMetrics(metricsTimeframe);

      expect(realTimeMetrics).toEqual({
        timeframe: metricsTimeframe,
        processingMetrics: {
          totalDocumentsProcessed: 2,
          successfulProcessing: 1,
          failedProcessing: 1,
          averageProcessingTime: 15000,
          throughputPerMinute: expect.any(Number),
          currentActiveUsers: expect.any(Number)
        },
        performanceMetrics: {
          apiResponseTimes: expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(Date),
              responseTime: expect.any(Number),
              endpoint: expect.any(String)
            })
          ]),
          systemResourceUsage: expect.objectContaining({
            cpuUsage: expect.any(Number),
            memoryUsage: expect.any(Number),
            diskUsage: expect.any(Number),
            networkUsage: expect.any(Number)
          }),
          errorRates: expect.objectContaining({
            total: expect.any(Number),
            byType: expect.any(Object),
            trend: expect.stringMatching(/^(increasing|decreasing|stable)$/)
          })
        },
        userActivityMetrics: {
          activeUsers: expect.any(Number),
          newUsers: expect.any(Number),
          userEngagement: expect.objectContaining({
            averageSessionDuration: expect.any(Number),
            documentsPerUser: expect.any(Number),
            returnUserRate: expect.any(Number)
          })
        },
        timeSeriesData: expect.arrayContaining([
          expect.objectContaining({
            timestamp: expect.any(Date),
            metrics: expect.objectContaining({
              documentsProcessed: expect.any(Number),
              activeUsers: expect.any(Number),
              systemLoad: expect.any(Number)
            })
          })
        ])
      });

      expect(realTimeMetrics.processingMetrics.totalDocumentsProcessed).toBe(2);
      expect(realTimeMetrics.processingMetrics.successfulProcessing).toBe(1);
      expect(realTimeMetrics.processingMetrics.failedProcessing).toBe(1);
    });

    it('should provide interactive dashboard widgets with drill-down capabilities', async () => {
      // RED: This test should fail - interactive dashboard not implemented
      const dashboardConfig = {
        userId: 'admin_user',
        dashboardType: 'executive_summary',
        widgets: [
          { type: 'processing_volume_chart', timeRange: '24h', position: { x: 0, y: 0, width: 6, height: 4 } },
          { type: 'success_rate_gauge', timeRange: '1h', position: { x: 6, y: 0, width: 3, height: 4 } },
          { type: 'error_breakdown_pie', timeRange: '24h', position: { x: 9, y: 0, width: 3, height: 4 } },
          { type: 'user_activity_heatmap', timeRange: '7d', position: { x: 0, y: 4, width: 12, height: 6 } }
        ],
        refreshInterval: 30000, // 30 seconds
        interactivity: {
          enableDrillDown: true,
          enableFiltering: true,
          enableExport: true
        }
      };

      const dashboard = await analyticsDashboard.createInteractiveDashboard(dashboardConfig);

      expect(dashboard).toEqual({
        dashboardId: expect.any(String),
        userId: 'admin_user',
        dashboardType: 'executive_summary',
        createdAt: expect.any(Date),
        lastUpdated: expect.any(Date),
        widgets: expect.arrayContaining([
          expect.objectContaining({
            widgetId: expect.any(String),
            type: 'processing_volume_chart',
            data: expect.objectContaining({
              chartType: 'line',
              dataPoints: expect.any(Array),
              xAxis: expect.objectContaining({ label: 'Time', type: 'datetime' }),
              yAxis: expect.objectContaining({ label: 'Documents Processed', type: 'numeric' })
            }),
            interactionOptions: expect.objectContaining({
              drillDownAvailable: true,
              filterOptions: expect.any(Array),
              exportFormats: expect.arrayContaining(['png', 'pdf', 'csv'])
            })
          }),
          expect.objectContaining({
            widgetId: expect.any(String),
            type: 'success_rate_gauge',
            data: expect.objectContaining({
              currentValue: expect.any(Number),
              targetValue: expect.any(Number),
              thresholds: expect.objectContaining({
                excellent: expect.any(Number),
                good: expect.any(Number),
                warning: expect.any(Number),
                critical: expect.any(Number)
              })
            })
          })
        ]),
        refreshSettings: expect.objectContaining({
          autoRefresh: true,
          refreshInterval: 30000,
          lastRefresh: expect.any(Date)
        }),
        shareSettings: expect.objectContaining({
          isPublic: false,
          shareUrl: expect.any(String),
          embedCode: expect.any(String)
        })
      });

      expect(dashboard.widgets).toHaveLength(4);
      expect(dashboard.widgets[0].interactionOptions.drillDownAvailable).toBe(true);
    });

    it('should generate trend analysis with predictive insights', async () => {
      // RED: This test should fail - trend analysis not implemented
      const historicalData = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
        documentsProcessed: 100 + Math.floor(Math.random() * 50) + i * 2, // Upward trend
        successRate: 0.85 + Math.random() * 0.1,
        averageProcessingTime: 15000 + Math.random() * 5000,
        activeUsers: 20 + Math.floor(Math.random() * 10) + Math.floor(i / 5),
        errorCount: Math.floor(Math.random() * 10)
      }));

      for (const dataPoint of historicalData) {
        await metricsCollector.recordDailyMetrics(dataPoint);
      }

      const trendAnalysis = await trendAnalyzer.analyzeTrends({
        metrics: ['documentsProcessed', 'successRate', 'averageProcessingTime', 'activeUsers'],
        timeRange: '30d',
        analysisType: 'comprehensive',
        includePredictions: true,
        predictionHorizon: '7d'
      });

      expect(trendAnalysis).toEqual({
        analysisId: expect.any(String),
        timeRange: '30d',
        generatedAt: expect.any(Date),
        trends: expect.objectContaining({
          documentsProcessed: expect.objectContaining({
            direction: expect.stringMatching(/^(increasing|decreasing|stable)$/),
            strength: expect.any(Number), // 0-1 scale
            confidence: expect.any(Number), // 0-1 scale
            changeRate: expect.any(Number), // percentage change
            seasonality: expect.objectContaining({
              detected: expect.any(Boolean),
              pattern: expect.any(String),
              strength: expect.any(Number)
            })
          }),
          successRate: expect.objectContaining({
            direction: expect.any(String),
            strength: expect.any(Number),
            confidence: expect.any(Number),
            volatility: expect.any(Number)
          })
        }),
        predictions: expect.objectContaining({
          documentsProcessed: expect.arrayContaining([
            expect.objectContaining({
              date: expect.any(Date),
              predictedValue: expect.any(Number),
              confidenceInterval: expect.objectContaining({
                lower: expect.any(Number),
                upper: expect.any(Number)
              }),
              factors: expect.any(Array)
            })
          ])
        }),
        insights: expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/^(trend|anomaly|forecast|recommendation)$/),
            severity: expect.stringMatching(/^(low|medium|high|critical)$/),
            message: expect.any(String),
            actionable: expect.any(Boolean),
            suggestedActions: expect.any(Array)
          })
        ]),
        correlations: expect.arrayContaining([
          expect.objectContaining({
            metric1: expect.any(String),
            metric2: expect.any(String),
            correlation: expect.any(Number), // -1 to 1
            significance: expect.any(Number),
            interpretation: expect.any(String)
          })
        ])
      });

      expect(trendAnalysis.trends.documentsProcessed.direction).toMatch(/^(increasing|decreasing|stable)$/);
      expect(trendAnalysis.predictions.documentsProcessed).toHaveLength(7); // 7 days prediction
    });
  });

  describe('Business Intelligence and Reporting', () => {
    it('should generate comprehensive business intelligence reports', async () => {
      // RED: This test should fail - BI reporting not implemented
      const reportRequest = {
        reportType: 'monthly_business_summary',
        timeRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        },
        includeSegments: ['user_demographics', 'document_types', 'revenue_analysis', 'operational_efficiency'],
        outputFormat: 'interactive_html',
        recipients: ['admin@company.com', 'ceo@company.com'],
        scheduledDelivery: {
          frequency: 'monthly',
          dayOfMonth: 1,
          timeOfDay: '09:00'
        }
      };

      const businessReport = await reportGenerator.generateBusinessIntelligenceReport(reportRequest);

      expect(businessReport).toEqual({
        reportId: expect.any(String),
        reportType: 'monthly_business_summary',
        generatedAt: expect.any(Date),
        timeRange: reportRequest.timeRange,
        executiveSummary: expect.objectContaining({
          keyMetrics: expect.objectContaining({
            totalDocumentsProcessed: expect.any(Number),
            totalRevenue: expect.any(Number),
            customerGrowth: expect.any(Number),
            operationalEfficiency: expect.any(Number)
          }),
          highlights: expect.arrayContaining([
            expect.objectContaining({
              metric: expect.any(String),
              value: expect.any(Number),
              change: expect.any(Number),
              significance: expect.any(String)
            })
          ]),
          concerns: expect.any(Array),
          opportunities: expect.any(Array)
        }),
        segments: expect.objectContaining({
          user_demographics: expect.objectContaining({
            totalUsers: expect.any(Number),
            newUsers: expect.any(Number),
            userRetention: expect.any(Number),
            geographicDistribution: expect.any(Object),
            usagePatterns: expect.any(Object)
          }),
          document_types: expect.objectContaining({
            typeDistribution: expect.any(Object),
            processingAccuracy: expect.any(Object),
            popularityTrends: expect.any(Array)
          }),
          revenue_analysis: expect.objectContaining({
            totalRevenue: expect.any(Number),
            revenueBySegment: expect.any(Object),
            averageRevenuePerUser: expect.any(Number),
            revenueGrowthRate: expect.any(Number)
          }),
          operational_efficiency: expect.objectContaining({
            processingSpeed: expect.any(Number),
            resourceUtilization: expect.any(Number),
            costPerDocument: expect.any(Number),
            qualityMetrics: expect.any(Object)
          })
        }),
        visualizations: expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            title: expect.any(String),
            data: expect.any(Object),
            insights: expect.any(Array)
          })
        ]),
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            category: expect.any(String),
            priority: expect.stringMatching(/^(low|medium|high|critical)$/),
            recommendation: expect.any(String),
            expectedImpact: expect.any(String),
            implementationEffort: expect.any(String)
          })
        ]),
        deliveryInfo: expect.objectContaining({
          outputFormat: 'interactive_html',
          fileSize: expect.any(Number),
          downloadUrl: expect.any(String),
          emailDelivered: true,
          recipients: reportRequest.recipients
        })
      });

      expect(businessReport.segments.user_demographics.totalUsers).toBeGreaterThan(0);
      expect(businessReport.recommendations).toHaveLength(expect.any(Number));
    });

    it('should provide advanced data visualization with custom chart types', async () => {
      // RED: This test should fail - advanced visualization not implemented
      const visualizationRequest = {
        chartType: 'advanced_multi_axis_time_series',
        dataSource: 'processing_metrics',
        timeRange: '7d',
        metrics: [
          { name: 'documentsProcessed', axis: 'left', color: '#3498db', type: 'line' },
          { name: 'successRate', axis: 'right', color: '#2ecc71', type: 'area' },
          { name: 'errorCount', axis: 'left', color: '#e74c3c', type: 'bar' }
        ],
        annotations: [
          { type: 'event', timestamp: new Date('2024-01-15T10:00:00Z'), label: 'System Upgrade', color: '#f39c12' },
          { type: 'threshold', value: 95, axis: 'right', label: 'Target Success Rate', style: 'dashed' }
        ],
        interactivity: {
          zoom: true,
          pan: true,
          tooltip: true,
          crossfilter: true,
          brushing: true
        },
        styling: {
          theme: 'professional',
          responsive: true,
          animations: true
        }
      };

      const visualization = await analyticsDashboard.createAdvancedVisualization(visualizationRequest);

      expect(visualization).toEqual({
        visualizationId: expect.any(String),
        chartType: 'advanced_multi_axis_time_series',
        createdAt: expect.any(Date),
        configuration: visualizationRequest,
        chartData: expect.objectContaining({
          datasets: expect.arrayContaining([
            expect.objectContaining({
              label: 'documentsProcessed',
              data: expect.any(Array),
              borderColor: '#3498db',
              yAxisID: 'left'
            }),
            expect.objectContaining({
              label: 'successRate',
              data: expect.any(Array),
              backgroundColor: expect.any(String),
              yAxisID: 'right'
            })
          ]),
          labels: expect.any(Array)
        }),
        chartOptions: expect.objectContaining({
          responsive: true,
          animation: expect.any(Object),
          scales: expect.objectContaining({
            left: expect.objectContaining({
              type: 'linear',
              position: 'left',
              title: expect.any(Object)
            }),
            right: expect.objectContaining({
              type: 'linear',
              position: 'right',
              title: expect.any(Object)
            })
          }),
          plugins: expect.objectContaining({
            tooltip: expect.any(Object),
            zoom: expect.any(Object),
            annotation: expect.objectContaining({
              annotations: expect.any(Object)
            })
          })
        }),
        interactionCapabilities: expect.objectContaining({
          zoomEnabled: true,
          panEnabled: true,
          tooltipEnabled: true,
          crossfilterEnabled: true,
          brushingEnabled: true
        }),
        exportOptions: expect.arrayContaining(['png', 'svg', 'pdf', 'json']),
        embedCode: expect.any(String)
      });

      expect(visualization.chartData.datasets).toHaveLength(3);
      expect(visualization.interactionCapabilities.zoomEnabled).toBe(true);
    });

    it('should implement predictive analytics for capacity planning', async () => {
      // RED: This test should fail - predictive analytics not implemented
      const capacityPlanningRequest = {
        analysisType: 'capacity_forecasting',
        timeHorizon: '90d', // 90 days ahead
        currentCapacity: {
          maxConcurrentUsers: 1000,
          maxDocumentsPerHour: 5000,
          storageCapacityGB: 10000,
          processingPowerUnits: 100
        },
        growthAssumptions: {
          userGrowthRate: 0.15, // 15% monthly
          usageGrowthRate: 0.10, // 10% monthly
          seasonalFactors: {
            'Q1': 1.0,
            'Q2': 1.2,
            'Q3': 0.8,
            'Q4': 1.4
          }
        },
        scenarios: ['conservative', 'expected', 'aggressive'],
        alertThresholds: {
          capacityUtilization: 0.8, // 80%
          responseTimeDegradation: 0.2, // 20% slower
          errorRateIncrease: 0.05 // 5% increase
        }
      };

      const capacityForecast = await predictiveAnalytics.generateCapacityForecast(capacityPlanningRequest);

      expect(capacityForecast).toEqual({
        forecastId: expect.any(String),
        generatedAt: expect.any(Date),
        timeHorizon: '90d',
        scenarios: expect.objectContaining({
          conservative: expect.objectContaining({
            projectedDemand: expect.arrayContaining([
              expect.objectContaining({
                date: expect.any(Date),
                expectedUsers: expect.any(Number),
                expectedDocuments: expect.any(Number),
                requiredCapacity: expect.objectContaining({
                  processingPower: expect.any(Number),
                  storage: expect.any(Number),
                  bandwidth: expect.any(Number)
                })
              })
            ]),
            capacityGaps: expect.any(Array),
            recommendedActions: expect.any(Array)
          }),
          expected: expect.objectContaining({
            projectedDemand: expect.any(Array),
            capacityGaps: expect.any(Array),
            recommendedActions: expect.any(Array)
          }),
          aggressive: expect.objectContaining({
            projectedDemand: expect.any(Array),
            capacityGaps: expect.any(Array),
            recommendedActions: expect.any(Array)
          })
        }),
        riskAssessment: expect.objectContaining({
          probabilityOfCapacityShortfall: expect.any(Number),
          impactAssessment: expect.objectContaining({
            userExperience: expect.any(String),
            businessImpact: expect.any(String),
            financialImpact: expect.any(Number)
          }),
          mitigationStrategies: expect.any(Array)
        }),
        investmentRecommendations: expect.arrayContaining([
          expect.objectContaining({
            category: expect.any(String),
            priority: expect.any(String),
            estimatedCost: expect.any(Number),
            expectedBenefit: expect.any(String),
            timeline: expect.any(String),
            roi: expect.any(Number)
          })
        ]),
        alertSchedule: expect.arrayContaining([
          expect.objectContaining({
            alertDate: expect.any(Date),
            alertType: expect.any(String),
            severity: expect.any(String),
            message: expect.any(String),
            recommendedAction: expect.any(String)
          })
        ])
      });

      expect(capacityForecast.scenarios.conservative.projectedDemand).toHaveLength(expect.any(Number));
      expect(capacityForecast.riskAssessment.probabilityOfCapacityShortfall).toBeGreaterThanOrEqual(0);
      expect(capacityForecast.riskAssessment.probabilityOfCapacityShortfall).toBeLessThanOrEqual(1);
    });
  });

  describe('Alert Management and Monitoring', () => {
    it('should implement intelligent alerting with escalation policies', async () => {
      // RED: This test should fail - intelligent alerting not implemented
      const alertConfiguration = {
        alertRules: [
          {
            name: 'High Error Rate Alert',
            metric: 'error_rate',
            condition: 'greater_than',
            threshold: 0.05, // 5%
            timeWindow: '5m',
            severity: 'high',
            escalationPolicy: 'immediate_escalation'
          },
          {
            name: 'Processing Queue Backup',
            metric: 'queue_length',
            condition: 'greater_than',
            threshold: 100,
            timeWindow: '10m',
            severity: 'medium',
            escalationPolicy: 'standard_escalation'
          },
          {
            name: 'System Resource Exhaustion',
            metric: 'cpu_usage',
            condition: 'greater_than',
            threshold: 0.9, // 90%
            timeWindow: '3m',
            severity: 'critical',
            escalationPolicy: 'emergency_escalation'
          }
        ],
        escalationPolicies: {
          immediate_escalation: {
            steps: [
              { delay: 0, recipients: ['oncall@company.com'], methods: ['email', 'sms'] },
              { delay: 300000, recipients: ['manager@company.com'], methods: ['email', 'phone'] }
            ]
          },
          standard_escalation: {
            steps: [
              { delay: 0, recipients: ['team@company.com'], methods: ['email'] },
              { delay: 900000, recipients: ['oncall@company.com'], methods: ['email', 'sms'] }
            ]
          },
          emergency_escalation: {
            steps: [
              { delay: 0, recipients: ['oncall@company.com', 'manager@company.com'], methods: ['email', 'sms', 'phone'] },
              { delay: 180000, recipients: ['cto@company.com'], methods: ['phone'] }
            ]
          }
        },
        notificationChannels: {
          email: { enabled: true, templates: 'professional' },
          sms: { enabled: true, provider: 'twilio' },
          phone: { enabled: true, provider: 'pagerduty' },
          slack: { enabled: true, webhook: 'https://hooks.slack.com/...' },
          teams: { enabled: false }
        }
      };

      await alertManager.configureAlerts(alertConfiguration);

      // Simulate alert condition
      const alertTrigger = await alertManager.evaluateAlertConditions({
        metrics: {
          error_rate: 0.08, // 8% - exceeds 5% threshold
          queue_length: 150, // Exceeds 100 threshold
          cpu_usage: 0.75 // Below 90% threshold
        },
        timestamp: new Date()
      });

      expect(alertTrigger).toEqual({
        evaluationId: expect.any(String),
        evaluatedAt: expect.any(Date),
        triggeredAlerts: expect.arrayContaining([
          expect.objectContaining({
            alertId: expect.any(String),
            alertName: 'High Error Rate Alert',
            severity: 'high',
            triggeredAt: expect.any(Date),
            currentValue: 0.08,
            threshold: 0.05,
            escalationPolicy: 'immediate_escalation',
            notificationsSent: expect.arrayContaining([
              expect.objectContaining({
                recipient: 'oncall@company.com',
                method: 'email',
                sentAt: expect.any(Date),
                status: 'sent'
              })
            ])
          }),
          expect.objectContaining({
            alertId: expect.any(String),
            alertName: 'Processing Queue Backup',
            severity: 'medium',
            triggeredAt: expect.any(Date),
            currentValue: 150,
            threshold: 100
          })
        ]),
        suppressedAlerts: expect.any(Array),
        nextEvaluation: expect.any(Date)
      });

      expect(alertTrigger.triggeredAlerts).toHaveLength(2);
      expect(alertTrigger.triggeredAlerts[0].notificationsSent).toHaveLength(expect.any(Number));
    });

    it('should provide anomaly detection with machine learning', async () => {
      // RED: This test should fail - ML anomaly detection not implemented
      const anomalyDetectionConfig = {
        metrics: ['processing_time', 'success_rate', 'user_activity', 'system_load'],
        detectionMethods: ['statistical', 'machine_learning', 'pattern_recognition'],
        sensitivity: 'medium', // low, medium, high
        learningPeriod: '30d',
        alertThreshold: 0.8, // 80% confidence
        excludeKnownEvents: true,
        seasonalityAdjustment: true
      };

      // Simulate historical normal data
      const historicalData = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(Date.now() - (100 - i) * 3600000), // Hourly data
        processing_time: 15000 + Math.random() * 3000, // Normal: 15-18s
        success_rate: 0.95 + Math.random() * 0.04, // Normal: 95-99%
        user_activity: 50 + Math.random() * 20, // Normal: 50-70 users
        system_load: 0.6 + Math.random() * 0.2 // Normal: 60-80%
      }));

      // Add anomalous data points
      historicalData.push({
        timestamp: new Date(),
        processing_time: 45000, // Anomaly: 45s (3x normal)
        success_rate: 0.75, // Anomaly: 75% (below normal)
        user_activity: 45, // Normal
        system_load: 0.95 // Anomaly: 95% (above normal)
      });

      for (const dataPoint of historicalData) {
        await metricsCollector.recordMetrics(dataPoint);
      }

      const anomalyDetection = await alertManager.detectAnomalies(anomalyDetectionConfig);

      expect(anomalyDetection).toEqual({
        detectionId: expect.any(String),
        analyzedAt: expect.any(Date),
        analysisWindow: expect.objectContaining({
          startTime: expect.any(Date),
          endTime: expect.any(Date),
          dataPoints: expect.any(Number)
        }),
        detectedAnomalies: expect.arrayContaining([
          expect.objectContaining({
            anomalyId: expect.any(String),
            metric: 'processing_time',
            detectedAt: expect.any(Date),
            anomalyType: expect.stringMatching(/^(spike|drop|trend|pattern)$/),
            severity: expect.stringMatching(/^(low|medium|high|critical)$/),
            confidence: expect.any(Number),
            currentValue: 45000,
            expectedRange: expect.objectContaining({
              lower: expect.any(Number),
              upper: expect.any(Number)
            }),
            deviation: expect.any(Number),
            detectionMethod: expect.any(String),
            possibleCauses: expect.any(Array),
            recommendedActions: expect.any(Array)
          }),
          expect.objectContaining({
            metric: 'success_rate',
            currentValue: 0.75,
            anomalyType: 'drop'
          })
        ]),
        modelPerformance: expect.objectContaining({
          accuracy: expect.any(Number),
          precision: expect.any(Number),
          recall: expect.any(Number),
          falsePositiveRate: expect.any(Number)
        }),
        insights: expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            message: expect.any(String),
            actionable: expect.any(Boolean)
          })
        ])
      });

      expect(anomalyDetection.detectedAnomalies.length).toBeGreaterThan(0);
      expect(anomalyDetection.detectedAnomalies[0].confidence).toBeGreaterThan(0.8);
    });
  });
});
