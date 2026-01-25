// @ts-nocheck

/**
 * Training Data Manager
 *
 * TDD Phase: GREEN - Minimal implementation for training data management
 * Enhancement: Advanced AI/ML Features
 */

export interface TrainingDataset {
  name: string;
  version: string;
  samples: Array<{
    id: string;
    documentType: string;
    text: string;
    features: Record<string, any>;
    labels: { primary: string; confidence: number };
  }>;
  metadata?: {
    createdAt: Date;
    totalSamples: number;
    classDistribution: Record<string, number>;
    qualityScore: number;
  };
}

export interface QualityReport {
  overallQuality: number;
  issues: Array<{
    type: string;
    sampleId: string;
    severity: string;
    description: string;
  }>;
  recommendations: string[];
  qualityScore: number;
  passesThreshold: boolean;
}

export class TrainingDataManager {
  private datasets: Map<string, TrainingDataset> = new Map();
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async createDataset(dataset: TrainingDataset): Promise<void> {
    const key = `${dataset.name}:${dataset.version}`;

    // Add metadata if not provided
    if (!dataset.metadata) {
      dataset.metadata = {
        createdAt: new Date(),
        totalSamples: dataset.samples.length,
        classDistribution: this.calculateClassDistribution(dataset.samples),
        qualityScore: 0.95 // Default quality score
      };
    }

    this.datasets.set(key, dataset);
  }

  async getDataset(name: string, version: string): Promise<TrainingDataset | null> {
    const key = `${name}:${version}`;
    const dataset = this.datasets.get(key);

    if (!dataset) return null;

    // Add statistics
    const statistics = {
      averageTextLength: this.calculateAverageTextLength(dataset.samples),
      featureDistribution: this.calculateFeatureDistribution(dataset.samples),
      labelQuality: this.calculateLabelQuality(dataset.samples)
    };

    return {
      ...dataset,
      statistics
    };
  }

  async validateDataQuality(dataset: TrainingDataset): Promise<QualityReport> {
    const issues: QualityReport['issues'] = [];

    for (const sample of dataset.samples) {
      // Check for empty text
      if (!sample.text || sample.text.trim().length === 0) {
        issues.push({
          type: 'empty_text',
          sampleId: sample.id,
          severity: 'critical',
          description: 'Sample has empty text content'
        });
      }

      // Check for short text
      if (sample.text && sample.text.length < 10) {
        issues.push({
          type: 'short_text',
          sampleId: sample.id,
          severity: 'high',
          description: 'Sample text is too short for meaningful classification'
        });
      }

      // Check for label mismatch
      if (sample.documentType !== sample.labels.primary) {
        issues.push({
          type: 'label_mismatch',
          sampleId: sample.id,
          severity: 'high',
          description: 'Document type does not match primary label'
        });
      }

      // Check for low confidence labels
      if (sample.labels.confidence < 0.5) {
        issues.push({
          type: 'low_confidence',
          sampleId: sample.id,
          severity: 'medium',
          description: 'Label confidence is below acceptable threshold'
        });
      }
    }

    const qualityScore = Math.max(0, 1 - (issues.length / dataset.samples.length));
    const overallQuality = qualityScore;
    const passesThreshold = qualityScore >= 0.7;

    const recommendations = this.generateRecommendations(issues);

    return {
      overallQuality,
      issues,
      recommendations,
      qualityScore,
      passesThreshold
    };
  }

  private calculateClassDistribution(samples: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const sample of samples) {
      const docType = sample.documentType;
      distribution[docType] = (distribution[docType] || 0) + 1;
    }

    return distribution;
  }

  private calculateAverageTextLength(samples: any[]): number {
    if (samples.length === 0) return 0;

    const totalLength = samples.reduce((sum, sample) => sum + (sample.text?.length || 0), 0);
    return totalLength / samples.length;
  }

  private calculateFeatureDistribution(samples: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const sample of samples) {
      for (const [feature, value] of Object.entries(sample.features || {})) {
        if (typeof value === 'boolean' && value) {
          distribution[feature] = (distribution[feature] || 0) + 1;
        }
      }
    }

    return distribution;
  }

  private calculateLabelQuality(samples: any[]): number {
    if (samples.length === 0) return 0;

    const totalConfidence = samples.reduce((sum, sample) => sum + (sample.labels?.confidence || 0), 0);
    return totalConfidence / samples.length;
  }

  private generateRecommendations(issues: QualityReport['issues']): string[] {
    const recommendations: string[] = [];

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');

    if (criticalIssues.length > 0) {
      recommendations.push('Remove samples with empty text');
    }

    if (highIssues.length > 0) {
      recommendations.push('Review and correct mislabeled samples');
      recommendations.push('Ensure minimum text length requirements');
    }

    if (issues.length > 0) {
      recommendations.push('Improve data collection and labeling processes');
    }

    return recommendations;
  }

  async cleanup(): Promise<void> {
    this.datasets.clear();
    this.isInitialized = false;
  }
}

export default TrainingDataManager;
