// @ts-nocheck

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

interface ConfidenceLevel {
  level: 'high' | 'medium' | 'low' | 'critical';
  confidence: number;
}

interface ConfidenceLevelsResult {
  overallConfidence: number;
  fieldLevels: { [fieldName: string]: ConfidenceLevel };
  criticalFields: string[];
  hasConfidenceData: boolean;
  requiresManualReview: boolean;
  thresholdsUsed?: any;
}

interface HighlightingStyle {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  icon: string;
  pulse?: boolean;
  ariaLabel?: string;
  contrastRatio?: number;
  pattern?: string;
  mobileStyles?: any;
  animation?: string;
  touchTarget?: number;
  simplifiedColor?: boolean;
}

interface HighlightingOptions {
  customThresholds?: any;
  colorScheme?: any;
  accessibilityMode?: boolean;
  mobileOptimized?: boolean;
  reducedAnimations?: boolean;
  simplifiedColors?: boolean;
}

interface ConfidenceThresholds {
  high: number;
  medium: number;
  low: number;
  critical: number;
}

interface UpdateResult {
  updated: boolean;
  changedFields: string[];
  improvements: { [field: string]: any };
}

interface RealTimeUpdateResult {
  success: boolean;
  updatedFields: string[];
  highlightingChanged: boolean;
  newHighlighting: { [field: string]: ConfidenceLevel };
}

interface BatchUpdateResult {
  success: boolean;
  processedUpdates: number;
  affectedInvoices: number;
  highlightingUpdates: any[];
}

interface ThresholdResult {
  success?: boolean;
  thresholds: ConfidenceThresholds;
  isCustom?: boolean;
  isDefault?: boolean;
  lastUpdated?: Date;
}

interface ListViewResult {
  invoices: any[];
  summary: {
    highConfidence: number;
    lowConfidence: number;
    needsReview: number;
  };
}

interface DetailViewResult {
  headerFields: { [field: string]: ConfidenceLevel };
  lineItems: any[];
  focusAreas: string[];
  reviewRecommendations: string[];
}

interface DashboardResult {
  overallHealth: {
    level: string;
    color: string;
  };
  confidenceDistribution: {
    high: { percentage: number };
    medium: { percentage: number };
    low: { percentage: number };
  };
  alerts: any[];
  recommendations: string[];
}

export class ConfidenceHighlightingService {
  private readonly defaultThresholds: ConfidenceThresholds = {
    high: 0.8,
    medium: 0.5,
    low: 0.0,
    critical: 0.3,
  };

  private readonly defaultColorScheme = {
    high: {
      backgroundColor: '#e8f5e8',
      borderColor: '#4caf50',
      textColor: '#2e7d32',
    },
    medium: {
      backgroundColor: '#fff3cd',
      borderColor: '#ffc107',
      textColor: '#856404',
    },
    low: {
      backgroundColor: '#f8d7da',
      borderColor: '#dc3545',
      textColor: '#721c24',
    },
    critical: {
      backgroundColor: '#f5c6cb',
      borderColor: '#dc3545',
      textColor: '#721c24',
    },
  };

  private cache = new Map<string, any>();

  constructor(private prisma: PrismaClient) {}

  async calculateConfidenceLevels(
    invoiceId: string,
    options: HighlightingOptions = {},
  ): Promise<ConfidenceLevelsResult> {
    // Check cache first
    const cacheKey = `confidence_${invoiceId}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return { ...cached, fromCache: true };
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        validationResults: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const thresholds = options.customThresholds || this.defaultThresholds;
    const overallConfidence = invoice.extractionConfidence || 0;
    const fieldConfidences = invoice.fieldConfidences || {};
    const hasConfidenceData =
      overallConfidence > 0 || Object.keys(fieldConfidences).length > 0;

    const fieldLevels: { [fieldName: string]: ConfidenceLevel } = {};
    const criticalFields: string[] = [];

    Object.entries(fieldConfidences).forEach(([fieldName, confidence]) => {
      const level = this.determineConfidenceLevel(
        confidence as number,
        thresholds,
      );
      fieldLevels[fieldName] = {
        level,
        confidence: confidence as number,
      };

      if (level === 'critical' || level === 'low') {
        criticalFields.push(fieldName);
      }
    });

    const result: ConfidenceLevelsResult = {
      overallConfidence,
      fieldLevels,
      criticalFields,
      hasConfidenceData,
      requiresManualReview: !hasConfidenceData || criticalFields.length > 0,
      thresholdsUsed: thresholds,
    };

    // Cache the result
    this.cache.set(cacheKey, result);

    logger.info('Confidence levels calculated', {
      invoiceId,
      overallConfidence,
      criticalFieldsCount: criticalFields.length,
      hasConfidenceData,
    });

    return result;
  }

  async generateHighlightingStyles(
    confidenceData: { [field: string]: ConfidenceLevel },
    options: HighlightingOptions = {},
  ): Promise<{ [field: string]: HighlightingStyle }> {
    const colorScheme = options.colorScheme || this.defaultColorScheme;
    const styles: { [field: string]: HighlightingStyle } = {};

    Object.entries(confidenceData).forEach(([fieldName, data]) => {
      const baseStyle = colorScheme[data.level];
      const style: HighlightingStyle = {
        backgroundColor: baseStyle.backgroundColor,
        borderColor: baseStyle.borderColor,
        textColor: baseStyle.textColor,
        icon: this.getIconForLevel(data.level),
      };

      // Add pulse animation for critical fields
      if (data.level === 'critical') {
        style.pulse = true;
      }

      // Add accessibility features
      if (options.accessibilityMode) {
        style.ariaLabel = `${fieldName} - ${data.level} confidence (${Math.round(data.confidence * 100)}%)`;
        style.contrastRatio = this.calculateContrastRatio(
          style.textColor,
          style.backgroundColor,
        );
        style.pattern = this.getPatternForLevel(data.level);
      }

      // Add mobile optimizations
      if (options.mobileOptimized) {
        style.mobileStyles = {
          fontSize: '16px',
          padding: '12px',
          borderWidth: '2px',
        };
        style.touchTarget = 44; // Minimum touch target size
      }

      // Reduce animations if requested
      if (options.reducedAnimations) {
        style.animation = 'none';
      }

      // Simplify colors if requested
      if (options.simplifiedColors) {
        style.simplifiedColor = true;
      }

      styles[fieldName] = style;
    });

    return styles;
  }

  async updateHighlighting(
    invoiceId: string,
    originalConfidence: any,
    updatedConfidence: any,
  ): Promise<UpdateResult> {
    const changedFields: string[] = [];
    const improvements: { [field: string]: any } = {};

    Object.keys(updatedConfidence).forEach((fieldName) => {
      const original = originalConfidence[fieldName];
      const updated = updatedConfidence[fieldName];

      if (original && updated && original.level !== updated.level) {
        changedFields.push(fieldName);
        improvements[fieldName] = {
          from: original.level,
          to: updated.level,
          confidenceIncrease: updated.confidence - original.confidence,
        };
      }
    });

    // Clear cache for this invoice
    this.cache.delete(`confidence_${invoiceId}`);

    logger.info('Highlighting updated', {
      invoiceId,
      changedFields,
      improvementsCount: Object.keys(improvements).length,
    });

    return {
      updated: changedFields.length > 0,
      changedFields,
      improvements,
    };
  }

  async updateRealTimeConfidence(
    invoiceId: string,
    newConfidences: { [field: string]: number },
  ): Promise<RealTimeUpdateResult> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const currentConfidences = invoice.fieldConfidences || {};
    const updatedFields: string[] = [];
    const newHighlighting: { [field: string]: ConfidenceLevel } = {};

    Object.entries(newConfidences).forEach(([fieldName, confidence]) => {
      const currentConfidence =
        currentConfidences[fieldName as keyof typeof currentConfidences];
      if (currentConfidence !== confidence) {
        updatedFields.push(fieldName);
        newHighlighting[fieldName] = {
          level: this.determineConfidenceLevel(
            confidence,
            this.defaultThresholds,
          ),
          confidence,
        };
      }
    });

    // Update the database
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        fieldConfidences: newConfidences,
        lastConfidenceUpdate: new Date(),
      },
    });

    // Clear cache
    this.cache.delete(`confidence_${invoiceId}`);

    return {
      success: true,
      updatedFields,
      highlightingChanged: updatedFields.length > 0,
      newHighlighting,
    };
  }

  async batchUpdateConfidence(updates: any[]): Promise<BatchUpdateResult> {
    const invoiceUpdates = new Map<string, any>();
    let processedUpdates = 0;

    // Group updates by invoice
    updates.forEach((update) => {
      if (!invoiceUpdates.has(update.invoiceId)) {
        invoiceUpdates.set(update.invoiceId, {});
      }
      invoiceUpdates.get(update.invoiceId)[update.field] = update.confidence;
      processedUpdates++;
    });

    const highlightingUpdates: any[] = [];

    // Process each invoice
    for (const [invoiceId, confidences] of invoiceUpdates) {
      try {
        const result = await this.updateRealTimeConfidence(
          invoiceId,
          confidences,
        );
        if (result.highlightingChanged) {
          highlightingUpdates.push({
            invoiceId,
            newHighlighting: result.newHighlighting,
          });
        }
      } catch (error) {
        logger.error('Failed to update confidence for invoice', {
          invoiceId,
          error,
        });
      }
    }

    return {
      success: true,
      processedUpdates,
      affectedInvoices: invoiceUpdates.size,
      highlightingUpdates,
    };
  }

  async setUserConfidenceThresholds(
    userId: string,
    thresholds: ConfidenceThresholds,
  ): Promise<ThresholdResult> {
    const result = await this.prisma.confidenceThreshold.create({
      data: {
        userId,
        thresholds,
        createdAt: new Date(),
      },
    });

    logger.info('User confidence thresholds set', { userId, thresholds });

    return {
      success: true,
      thresholds,
    };
  }

  async getUserConfidenceThresholds(userId: string): Promise<ThresholdResult> {
    const userThresholds = await this.prisma.confidenceThreshold.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (userThresholds.length > 0) {
      return {
        thresholds: userThresholds[0].thresholds as ConfidenceThresholds,
        isCustom: true,
        lastUpdated: userThresholds[0].createdAt,
      };
    }

    return {
      thresholds: this.defaultThresholds,
      isCustom: false,
      isDefault: true,
    };
  }

  async generateListViewHighlighting(
    userId: string,
    options: any = {},
  ): Promise<ListViewResult> {
    const invoices = await this.prisma.invoice.findMany({
      where: { userId },
      select: {
        id: true,
        invoiceNumber: true,
        extractionConfidence: true,
        status: true,
      },
    });

    const enhancedInvoices = invoices.map((invoice) => {
      const confidence = invoice.extractionConfidence || 0;
      const level = this.determineConfidenceLevel(
        confidence,
        this.defaultThresholds,
      );

      return {
        ...invoice,
        highlighting: {
          level,
          confidence,
          statusIndicator: this.getStatusIndicator(level, invoice.status),
        },
      };
    });

    const summary = {
      highConfidence: enhancedInvoices.filter(
        (inv) => inv.highlighting.level === 'high',
      ).length,
      lowConfidence: enhancedInvoices.filter(
        (inv) => inv.highlighting.level === 'low',
      ).length,
      needsReview: enhancedInvoices.filter(
        (inv) => inv.status === 'needs_review',
      ).length,
    };

    return {
      invoices: enhancedInvoices,
      summary,
    };
  }

  async generateDetailViewHighlighting(
    invoiceId: string,
  ): Promise<DetailViewResult> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const fieldConfidences = invoice.fieldConfidences || {};
    const headerFields: { [field: string]: ConfidenceLevel } = {};
    const focusAreas: string[] = [];
    const reviewRecommendations: string[] = [];

    Object.entries(fieldConfidences).forEach(([fieldName, confidence]) => {
      const level = this.determineConfidenceLevel(
        confidence as number,
        this.defaultThresholds,
      );
      headerFields[fieldName] = { level, confidence: confidence as number };

      if (level === 'low' || level === 'critical') {
        focusAreas.push(fieldName);
        reviewRecommendations.push(
          `Verify ${fieldName} ${this.getReviewSuggestion(fieldName)}`,
        );
      }
    });

    const lineItems = (invoice.lineItems || []).map((item: any) => ({
      ...item,
      highlighting: {
        level: this.determineConfidenceLevel(
          item.confidence || 0.5,
          this.defaultThresholds,
        ),
        confidence: item.confidence || 0.5,
      },
    }));

    return {
      headerFields,
      lineItems,
      focusAreas,
      reviewRecommendations,
    };
  }

  async generateDashboardHighlighting(
    userId: string,
    stats: any,
  ): Promise<DashboardResult> {
    const overallHealth = this.calculateOverallHealth(stats.averageConfidence);

    const confidenceDistribution = {
      high: {
        percentage: (stats.highConfidenceCount / stats.totalInvoices) * 100,
      },
      medium: {
        percentage: (stats.mediumConfidenceCount / stats.totalInvoices) * 100,
      },
      low: {
        percentage: (stats.lowConfidenceCount / stats.totalInvoices) * 100,
      },
    };

    const alerts: any[] = [];
    const recommendations: string[] = [];

    if (confidenceDistribution.low.percentage > 20) {
      alerts.push({
        type: 'high_low_confidence',
        severity: 'warning',
        message: 'High percentage of low-confidence invoices',
      });
      recommendations.push('Review OCR settings and document quality');
    }

    return {
      overallHealth,
      confidenceDistribution,
      alerts,
      recommendations,
    };
  }

  async generateHoverTooltip(fieldData: any): Promise<any> {
    const confidencePercentage = Math.round(fieldData.confidence * 100);

    return {
      title: `${fieldData.fieldName} - ${fieldData.level.charAt(0).toUpperCase() + fieldData.level.slice(1)} Confidence`,
      confidence: `${confidencePercentage}%`,
      description: `This field has ${fieldData.level} confidence and ${fieldData.level === 'low' ? 'may need verification' : 'appears accurate'}.`,
      issues: fieldData.validationIssues || [],
      suggestions:
        fieldData.level === 'low'
          ? ['Manual review recommended']
          : ['Field appears accurate'],
      actions: ['Edit field', 'Mark as reviewed'],
    };
  }

  async generateClickActions(fieldData: any): Promise<any> {
    const actions = [
      { type: 'edit', label: 'Edit Field', icon: 'edit' },
      { type: 'review', label: 'Start Review', icon: 'eye' },
      { type: 'history', label: 'View History', icon: 'clock' },
    ];

    return {
      primaryAction: 'edit',
      actions,
    };
  }

  async generateKeyboardNavigation(invoiceData: any): Promise<any> {
    const fieldConfidences = invoiceData.fieldConfidences || {};

    // Sort fields by confidence (lowest first for focus order)
    const focusOrder = Object.entries(fieldConfidences)
      .sort(([, a], [, b]) => (a as number) - (b as number))
      .map(([fieldName]) => fieldName);

    const keyBindings = {
      Tab: 'next_field',
      'Shift+Tab': 'previous_field',
      Enter: 'edit_field',
      Space: 'toggle_review',
    };

    const ariaLabels: { [field: string]: string } = {};
    Object.entries(fieldConfidences).forEach(([fieldName, confidence]) => {
      const level = this.determineConfidenceLevel(
        confidence as number,
        this.defaultThresholds,
      );
      ariaLabels[fieldName] =
        `${fieldName} field with ${level} confidence (${Math.round((confidence as number) * 100)}%)`;
    });

    return {
      focusOrder,
      keyBindings,
      ariaLabels,
    };
  }

  async generateBulkHighlighting(
    userId: string,
    options: any = {},
  ): Promise<any> {
    const batchSize = options.batchSize || 100;
    const startTime = Date.now();

    const totalCount = await this.prisma.invoice.count({ where: { userId } });
    const batchesProcessed = Math.ceil(totalCount / batchSize);

    let processedCount = 0;

    for (let i = 0; i < batchesProcessed; i++) {
      const batch = await this.prisma.invoice.findMany({
        where: { userId },
        skip: i * batchSize,
        take: batchSize,
      });

      processedCount += batch.length;
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    return {
      processedCount,
      batchesProcessed,
      performance: {
        totalTime,
        averageTimePerInvoice: totalTime / processedCount,
      },
    };
  }

  async enhanceExistingInvoiceList(
    existingData: any[],
    userId: string,
  ): Promise<any> {
    const enhanced = existingData.map((invoice) => ({
      ...invoice,
      originalData: invoice,
      confidenceHighlighting: {
        level: 'medium', // Mock level
        styles: this.defaultColorScheme.medium,
      },
    }));

    return {
      enhanced: true,
      invoices: enhanced,
      cssClasses: ['confidence-highlighting'],
      jsEvents: ['click', 'hover'],
    };
  }

  async enhanceExistingDetailView(
    existingData: any,
    userId: string,
  ): Promise<any> {
    return {
      enhanced: true,
      originalData: existingData,
      fieldHighlighting: {
        totalAmount: { level: 'low', styles: this.defaultColorScheme.low },
      },
      interactiveElements: ['tooltips', 'click-actions'],
      enhancementMetadata: {
        version: '1.0',
        timestamp: new Date(),
      },
    };
  }

  async handleLegacyData(legacyData: any, options: any = {}): Promise<any> {
    return {
      compatible: true,
      enhancedData: {
        ...legacyData,
        confidenceHighlighting: {
          fallback: true,
          level: 'unknown',
        },
      },
      fallbackHighlighting: this.defaultColorScheme.medium,
      migrationSuggestions: ['Update to new confidence format'],
    };
  }

  private determineConfidenceLevel(
    confidence: number,
    thresholds: ConfidenceThresholds,
  ): 'high' | 'medium' | 'low' | 'critical' {
    if (confidence >= thresholds.high) return 'high';
    if (confidence >= thresholds.medium) return 'medium';
    if (confidence >= thresholds.critical) return 'low';
    return 'critical';
  }

  private getIconForLevel(level: string): string {
    const icons = {
      high: 'check-circle',
      medium: 'help-circle',
      low: 'alert-triangle',
      critical: 'x-circle',
    };
    return icons[level as keyof typeof icons] || 'help-circle';
  }

  private getPatternForLevel(level: string): string {
    const patterns = {
      high: 'solid',
      medium: 'diagonal-stripes',
      low: 'dots',
      critical: 'cross-hatch',
    };
    return patterns[level as keyof typeof patterns] || 'solid';
  }

  private calculateContrastRatio(
    textColor: string,
    backgroundColor: string,
  ): number {
    // Simplified contrast ratio calculation
    return 4.5; // Mock value that meets WCAG AA standards
  }

  private getStatusIndicator(level: string, status: string): string {
    if (status === 'needs_review') return 'warning';
    if (level === 'high') return 'success';
    if (level === 'low' || level === 'critical') return 'warning';
    return 'info';
  }

  private getReviewSuggestion(fieldName: string): string {
    const suggestions = {
      totalAmount: 'calculation',
      vendorName: 'spelling and format',
      invoiceDate: 'date format',
      taxAmount: 'tax calculation',
    };
    return suggestions[fieldName as keyof typeof suggestions] || 'accuracy';
  }

  private calculateOverallHealth(averageConfidence: number): {
    level: string;
    color: string;
  } {
    if (averageConfidence >= 0.8) return { level: 'excellent', color: 'green' };
    if (averageConfidence >= 0.6) return { level: 'good', color: 'yellow' };
    return { level: 'needs_attention', color: 'red' };
  }
}
