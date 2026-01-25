/**
 * Classification Accuracy Tracker
 * 
 * TDD Phase: GREEN - Minimal implementation for accuracy tracking
 * Enhancement: Advanced AI/ML Features
 */

export interface ClassificationRecord {
  predicted: string;
  actual: string;
  confidence: number;
  timestamp: Date;
}

export interface AccuracyReport {
  overallAccuracy: number;
  totalClassifications: number;
  correctClassifications: number;
  incorrectClassifications: number;
  classAccuracy: Record<string, {
    precision: number;
    recall: number;
    f1Score: number;
    support: number;
  }>;
  confusionMatrix: Record<string, Record<string, number>>;
  averageConfidence: number;
  confidenceDistribution: Record<string, number>;
  reportGeneratedAt: Date;
}

export interface DriftReport {
  driftDetected: boolean;
  driftScore: number;
  driftType: string;
  timeWindow: {
    start: Date;
    end: Date;
    duration: number;
  };
  metrics: {
    currentAccuracy: number;
    baselineAccuracy: number;
    accuracyDrop: number;
    confidenceDrop: number;
  };
  recommendations: string[];
  alertLevel: string;
}

export class ClassificationAccuracyTracker {
  private classifications: ClassificationRecord[] = [];
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async recordClassification(record: ClassificationRecord): Promise<void> {
    this.classifications.push({
      ...record,
      timestamp: record.timestamp || new Date()
    });

    // Keep only last 10000 records to prevent memory bloat
    if (this.classifications.length > 10000) {
      this.classifications = this.classifications.slice(-5000);
    }
  }

  async generateAccuracyReport(): Promise<AccuracyReport> {
    if (this.classifications.length === 0) {
      return this.getEmptyReport();
    }

    const correctClassifications = this.classifications.filter(c => c.predicted === c.actual).length;
    const totalClassifications = this.classifications.length;
    const overallAccuracy = correctClassifications / totalClassifications;

    const classAccuracy = this.calculateClassMetrics();
    const confusionMatrix = this.buildConfusionMatrix();
    const averageConfidence = this.calculateAverageConfidence();
    const confidenceDistribution = this.calculateConfidenceDistribution();

    return {
      overallAccuracy,
      totalClassifications,
      correctClassifications,
      incorrectClassifications: totalClassifications - correctClassifications,
      classAccuracy,
      confusionMatrix,
      averageConfidence,
      confidenceDistribution,
      reportGeneratedAt: new Date()
    };
  }

  async detectClassificationDrift(): Promise<DriftReport> {
    if (this.classifications.length < 50) {
      return this.getNoDriftReport();
    }

    // Split data into baseline (first half) and current (second half)
    const midpoint = Math.floor(this.classifications.length / 2);
    const baseline = this.classifications.slice(0, midpoint);
    const current = this.classifications.slice(midpoint);

    const baselineAccuracy = this.calculateAccuracy(baseline);
    const currentAccuracy = this.calculateAccuracy(current);
    const accuracyDrop = baselineAccuracy - currentAccuracy;

    const baselineConfidence = this.calculateAverageConfidenceForSet(baseline);
    const currentConfidence = this.calculateAverageConfidenceForSet(current);
    const confidenceDrop = baselineConfidence - currentConfidence;

    // Calculate drift score
    const driftScore = Math.max(accuracyDrop, confidenceDrop / 0.5); // Normalize confidence drop
    const driftDetected = driftScore > 0.1; // 10% threshold

    let driftType = 'none';
    if (accuracyDrop > 0.1) driftType = 'accuracy_drift';
    else if (confidenceDrop > 0.05) driftType = 'confidence_drift';

    const alertLevel = this.calculateAlertLevel(driftScore);
    const recommendations = this.generateDriftRecommendations(driftType, driftScore);

    return {
      driftDetected,
      driftScore,
      driftType,
      timeWindow: {
        start: current[0]?.timestamp || new Date(),
        end: current[current.length - 1]?.timestamp || new Date(),
        duration: current.length > 0 ? 
          (current[current.length - 1].timestamp.getTime() - current[0].timestamp.getTime()) : 0
      },
      metrics: {
        currentAccuracy,
        baselineAccuracy,
        accuracyDrop,
        confidenceDrop
      },
      recommendations,
      alertLevel
    };
  }

  private calculateClassMetrics(): Record<string, any> {
    const classes = [...new Set(this.classifications.map(c => c.actual))];
    const metrics: Record<string, any> = {};

    for (const className of classes) {
      const truePositives = this.classifications.filter(c => c.actual === className && c.predicted === className).length;
      const falsePositives = this.classifications.filter(c => c.actual !== className && c.predicted === className).length;
      const falseNegatives = this.classifications.filter(c => c.actual === className && c.predicted !== className).length;
      const support = this.classifications.filter(c => c.actual === className).length;

      const precision = truePositives / (truePositives + falsePositives) || 0;
      const recall = truePositives / (truePositives + falseNegatives) || 0;
      const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

      metrics[className] = { precision, recall, f1Score, support };
    }

    return metrics;
  }

  private buildConfusionMatrix(): Record<string, Record<string, number>> {
    const classes = [...new Set([
      ...this.classifications.map(c => c.actual),
      ...this.classifications.map(c => c.predicted)
    ])];

    const matrix: Record<string, Record<string, number>> = {};
    
    for (const actual of classes) {
      matrix[actual] = {};
      for (const predicted of classes) {
        matrix[actual][predicted] = this.classifications.filter(
          c => c.actual === actual && c.predicted === predicted
        ).length;
      }
    }

    return matrix;
  }

  private calculateAverageConfidence(): number {
    if (this.classifications.length === 0) return 0;
    
    const totalConfidence = this.classifications.reduce((sum, c) => sum + c.confidence, 0);
    return totalConfidence / this.classifications.length;
  }

  private calculateConfidenceDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {
      'low (0-0.5)': 0,
      'medium (0.5-0.8)': 0,
      'high (0.8-1.0)': 0
    };

    for (const classification of this.classifications) {
      if (classification.confidence < 0.5) {
        distribution['low (0-0.5)']++;
      } else if (classification.confidence < 0.8) {
        distribution['medium (0.5-0.8)']++;
      } else {
        distribution['high (0.8-1.0)']++;
      }
    }

    return distribution;
  }

  private calculateAccuracy(records: ClassificationRecord[]): number {
    if (records.length === 0) return 0;
    
    const correct = records.filter(r => r.predicted === r.actual).length;
    return correct / records.length;
  }

  private calculateAverageConfidenceForSet(records: ClassificationRecord[]): number {
    if (records.length === 0) return 0;
    
    const totalConfidence = records.reduce((sum, r) => sum + r.confidence, 0);
    return totalConfidence / records.length;
  }

  private calculateAlertLevel(driftScore: number): string {
    if (driftScore >= 0.3) return 'critical';
    if (driftScore >= 0.2) return 'high';
    if (driftScore >= 0.1) return 'medium';
    return 'low';
  }

  private generateDriftRecommendations(driftType: string, driftScore: number): string[] {
    const recommendations: string[] = [];

    if (driftType === 'accuracy_drift') {
      recommendations.push('Model accuracy has degraded - consider retraining');
      recommendations.push('Review recent data for quality issues');
    }

    if (driftType === 'confidence_drift') {
      recommendations.push('Model confidence has decreased - investigate input data changes');
    }

    if (driftScore > 0.2) {
      recommendations.push('Immediate attention required - significant performance degradation detected');
    }

    return recommendations;
  }

  private getEmptyReport(): AccuracyReport {
    return {
      overallAccuracy: 0,
      totalClassifications: 0,
      correctClassifications: 0,
      incorrectClassifications: 0,
      classAccuracy: {},
      confusionMatrix: {},
      averageConfidence: 0,
      confidenceDistribution: {},
      reportGeneratedAt: new Date()
    };
  }

  private getNoDriftReport(): DriftReport {
    return {
      driftDetected: false,
      driftScore: 0,
      driftType: 'insufficient_data',
      timeWindow: { start: new Date(), end: new Date(), duration: 0 },
      metrics: { currentAccuracy: 0, baselineAccuracy: 0, accuracyDrop: 0, confidenceDrop: 0 },
      recommendations: ['Collect more classification data for drift analysis'],
      alertLevel: 'low'
    };
  }

  async cleanup(): Promise<void> {
    this.classifications = [];
    this.isInitialized = false;
  }
}

export default ClassificationAccuracyTracker;
