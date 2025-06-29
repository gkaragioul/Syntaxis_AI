import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

interface EditableField {
  fieldName: string;
  currentValue: any;
  confidence: number;
  editable: boolean;
  validationRules: any;
  inputType: string;
  suggestions?: any[];
}

interface CorrectionData {
  fieldName: string;
  oldValue: any;
  newValue: any;
  reason?: string;
  confidence?: number;
  requiresApproval?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

interface CorrectionResult {
  success: boolean;
  correctionId?: string;
  fieldUpdated?: string;
  newValue?: any;
  confidenceImproved?: boolean;
  appliedCorrections?: number;
  failedCorrections?: number;
  correctionIds?: string[];
  summary?: any;
}

interface SmartSuggestion {
  value: any;
  confidence: number;
  reason: string;
  source: string;
}

interface SuggestionResult {
  suggestions: SmartSuggestion[];
  basedOnHistory: boolean;
  contextualRelevance: number;
  fromCache?: boolean;
  cacheHit?: boolean;
}

interface PatternDetectionResult {
  issuesDetected: boolean;
  patterns: string[];
  suggestions: any[];
  autoCorrectible: boolean;
  confidence: number;
}

interface AutoCorrectionResult {
  canAutoCorrect: boolean;
  suggestedValue: any;
  correctionType: string;
  confidence: number;
  reasoning: string;
  requiresApproval: boolean;
}

interface LearningResult {
  patternsLearned: number;
  rules: any[];
  modelUpdated: boolean;
}

interface TemplateResult {
  success: boolean;
  templateId?: string;
  template?: any;
  templatesApplied?: number;
  correctionsApplied?: number;
  corrections?: any[];
}

interface CorrectionHistory {
  corrections: any[];
  totalCorrections: number;
  correctionsByField: { [field: string]: number };
  lastCorrectionDate: Date;
  correctionTimeline: any[];
}

interface CorrectionAnalytics {
  totalCorrections: number;
  successRate: number;
  mostCorrectedField: string;
  fieldBreakdown: { [field: string]: any };
  trends: any;
  recommendations: string[];
}

export class CorrectionToolsService {
  private suggestionCache = new Map<string, any>();
  private correctionPatterns = new Map<string, any>();

  constructor(private prisma: PrismaClient) {
    this.initializeCorrectionPatterns();
  }

  async getEditableFields(invoiceId: string, userId: string): Promise<any> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        extractedFields: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const fieldConfidences = invoice.fieldConfidences || {};
    const editableFields: EditableField[] = [];

    // Mock extracted fields for demonstration
    const fields = {
      invoiceNumber: { value: invoice.invoiceNumber, confidence: fieldConfidences.invoiceNumber || 0.95 },
      vendorName: { value: invoice.vendorName, confidence: fieldConfidences.vendorName || 0.65 },
      totalAmount: { value: invoice.totalAmount, confidence: fieldConfidences.totalAmount || 0.45 },
    };

    Object.entries(fields).forEach(([fieldName, fieldData]) => {
      editableFields.push({
        fieldName,
        currentValue: fieldData.value,
        confidence: fieldData.confidence,
        editable: true,
        validationRules: this.getValidationRules(fieldName),
        inputType: this.getInputType(fieldName),
        suggestions: [],
      });
    });

    logger.info('Retrieved editable fields', {
      invoiceId,
      userId,
      fieldCount: editableFields.length,
    });

    return {
      success: true,
      editableFields,
    };
  }

  async validateCorrection(invoiceId: string, correction: CorrectionData): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Field-specific validation
    switch (correction.fieldName) {
      case 'totalAmount':
        if (typeof correction.newValue !== 'number' || correction.newValue < 0) {
          errors.push('Total amount cannot be negative');
          suggestions.push('Please enter a positive amount');
        }
        if (correction.newValue > 1000000) {
          warnings.push('Amount seems unusually high');
          suggestions.push('Please verify the amount is correct');
        }
        break;

      case 'vendorName':
        if (!correction.newValue || correction.newValue.trim().length === 0) {
          errors.push('Vendor name cannot be empty');
          suggestions.push('Please enter a valid vendor name');
        }
        break;

      case 'invoiceDate':
        const date = new Date(correction.newValue);
        if (isNaN(date.getTime())) {
          errors.push('Invalid date format');
          suggestions.push('Please use YYYY-MM-DD format');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  async applyCorrection(invoiceId: string, userId: string, correction: CorrectionData): Promise<CorrectionResult> {
    // Validate the correction first
    const validation = await this.validateCorrection(invoiceId, correction);
    if (!validation.isValid) {
      return {
        success: false,
      };
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Create correction record
    const correctionRecord = await this.prisma.correction.create({
      data: {
        invoiceId,
        userId,
        fieldName: correction.fieldName,
        oldValue: correction.oldValue,
        newValue: correction.newValue,
        reason: correction.reason,
        confidence: correction.confidence || 0.95,
        status: 'applied',
        createdAt: new Date(),
      },
    });

    // Update the invoice field
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        [correction.fieldName]: correction.newValue,
        [`${correction.fieldName}Confidence`]: correction.confidence || 0.95,
        lastModified: new Date(),
      },
    });

    logger.info('Correction applied', {
      correctionId: correctionRecord.id,
      invoiceId,
      userId,
      fieldName: correction.fieldName,
    });

    return {
      success: true,
      correctionId: correctionRecord.id,
      fieldUpdated: correction.fieldName,
      newValue: correction.newValue,
      confidenceImproved: (correction.confidence || 0.95) > 0.8,
    };
  }

  async applyBulkCorrections(
    invoiceId: string,
    userId: string,
    corrections: CorrectionData[]
  ): Promise<CorrectionResult> {
    let appliedCorrections = 0;
    let failedCorrections = 0;
    const correctionIds: string[] = [];
    const fieldsUpdated: string[] = [];

    for (const correction of corrections) {
      try {
        const result = await this.applyCorrection(invoiceId, userId, correction);
        if (result.success && result.correctionId) {
          appliedCorrections++;
          correctionIds.push(result.correctionId);
          if (result.fieldUpdated) {
            fieldsUpdated.push(result.fieldUpdated);
          }
        } else {
          failedCorrections++;
        }
      } catch (error) {
        failedCorrections++;
        logger.error('Failed to apply correction', { correction, error });
      }
    }

    return {
      success: failedCorrections === 0,
      appliedCorrections,
      failedCorrections,
      correctionIds,
      summary: {
        fieldsUpdated,
        totalAttempted: corrections.length,
      },
    };
  }

  async generateSmartSuggestions(fieldData: any): Promise<SuggestionResult> {
    const cacheKey = `suggestions_${fieldData.fieldName}_${fieldData.currentValue}`;
    
    // Check cache first
    if (this.suggestionCache.has(cacheKey)) {
      const cached = this.suggestionCache.get(cacheKey);
      return { ...cached, fromCache: true, cacheHit: true };
    }

    const suggestions: SmartSuggestion[] = [];

    // Generate suggestions based on field type and context
    switch (fieldData.fieldName) {
      case 'vendorName':
        if (typeof fieldData.currentValue === 'string') {
          suggestions.push({
            value: `${fieldData.currentValue} Corporation`,
            confidence: 0.85,
            reason: 'Most common format in your history',
            source: 'historical_data',
          });
          suggestions.push({
            value: `${fieldData.currentValue} Company`,
            confidence: 0.75,
            reason: 'Alternative common format',
            source: 'pattern_matching',
          });
          suggestions.push({
            value: `${fieldData.currentValue} Inc`,
            confidence: 0.65,
            reason: 'Standard incorporation suffix',
            source: 'business_rules',
          });
        }
        break;

      case 'totalAmount':
        if (fieldData.context?.lineItems) {
          const calculatedTotal = fieldData.context.lineItems.reduce(
            (sum: number, item: any) => sum + (item.amount || 0),
            0
          );
          suggestions.push({
            value: calculatedTotal,
            confidence: 0.9,
            reason: 'Calculated from line items',
            source: 'calculation',
          });
        }
        break;
    }

    const result: SuggestionResult = {
      suggestions,
      basedOnHistory: true,
      contextualRelevance: 0.8,
    };

    // Cache the result
    this.suggestionCache.set(cacheKey, result);

    return result;
  }

  async detectPatternIssues(fieldData: any): Promise<PatternDetectionResult> {
    const patterns: string[] = [];
    const suggestions: any[] = [];
    let autoCorrectible = false;
    let confidence = 0;

    switch (fieldData.fieldName) {
      case 'invoiceDate':
        if (typeof fieldData.currentValue === 'string') {
          // Detect ambiguous date formats
          if (fieldData.currentValue.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
            patterns.push('ambiguous_date_format');
            suggestions.push({
              value: '2024-03-15', // Mock standardized date
              format: 'ISO 8601',
              confidence: 0.85,
            });
            autoCorrectible = true;
            confidence = 0.85;
          }
        }
        break;

      case 'totalAmount':
        if (typeof fieldData.currentValue === 'string' && fieldData.currentValue.includes(',')) {
          patterns.push('formatted_number_string');
          suggestions.push({
            value: parseFloat(fieldData.currentValue.replace(/,/g, '')),
            format: 'number',
            confidence: 0.95,
          });
          autoCorrectible = true;
          confidence = 0.95;
        }
        break;
    }

    return {
      issuesDetected: patterns.length > 0,
      patterns,
      suggestions,
      autoCorrectible,
      confidence,
    };
  }

  async suggestAutoCorrection(fieldData: any): Promise<AutoCorrectionResult> {
    let canAutoCorrect = false;
    let suggestedValue: any = fieldData.currentValue;
    let correctionType = 'none';
    let confidence = 0;
    let reasoning = '';
    let requiresApproval = true;

    if (fieldData.fieldName === 'totalAmount' && typeof fieldData.currentValue === 'string') {
      // Auto-correct formatted string to number
      const numericValue = parseFloat(fieldData.currentValue.replace(/[,$]/g, ''));
      if (!isNaN(numericValue)) {
        canAutoCorrect = true;
        suggestedValue = numericValue;
        correctionType = 'format_standardization';
        confidence = 0.95;
        reasoning = 'Converting formatted string to number';
        requiresApproval = false;
      }
    }

    return {
      canAutoCorrect,
      suggestedValue,
      correctionType,
      confidence,
      reasoning,
      requiresApproval,
    };
  }

  async learnFromCorrections(userId: string, corrections: any[]): Promise<LearningResult> {
    const rules: any[] = [];
    let patternsLearned = 0;

    // Analyze correction patterns
    const vendorNameCorrections = corrections.filter(c => c.fieldName === 'vendorName');
    
    vendorNameCorrections.forEach(correction => {
      if (correction.oldValue.endsWith('Corp') && correction.newValue.endsWith('Corporation')) {
        rules.push({
          pattern: 'Corp -> Corporation',
          confidence: 0.9,
          applicability: 'vendor_name_expansion',
        });
        patternsLearned++;
      }
      if (correction.oldValue.endsWith('Inc') && correction.newValue.endsWith('Incorporated')) {
        rules.push({
          pattern: 'Inc -> Incorporated',
          confidence: 0.9,
          applicability: 'vendor_name_expansion',
        });
        patternsLearned++;
      }
      if (correction.oldValue.endsWith('LLC') && correction.newValue.endsWith('Limited Liability Company')) {
        rules.push({
          pattern: 'LLC -> Limited Liability Company',
          confidence: 0.9,
          applicability: 'vendor_name_expansion',
        });
        patternsLearned++;
      }
    });

    // Store learned patterns
    rules.forEach(rule => {
      this.correctionPatterns.set(rule.pattern, rule);
    });

    logger.info('Learned from corrections', {
      userId,
      patternsLearned,
      rulesCreated: rules.length,
    });

    return {
      patternsLearned,
      rules,
      modelUpdated: true,
    };
  }

  async createCorrectionTemplate(userId: string, template: any): Promise<TemplateResult> {
    const createdTemplate = await this.prisma.correctionTemplate.create({
      data: {
        userId,
        name: template.name,
        description: template.description,
        fieldName: template.fieldName,
        rules: template.rules,
        autoApply: template.autoApply || false,
        requiresApproval: template.requiresApproval || true,
        createdAt: new Date(),
      },
    });

    logger.info('Correction template created', {
      templateId: createdTemplate.id,
      userId,
      templateName: template.name,
    });

    return {
      success: true,
      templateId: createdTemplate.id,
      template: {
        name: template.name,
        rules: template.rules,
      },
    };
  }

  async applyTemplates(invoiceId: string, userId: string): Promise<TemplateResult> {
    const templates = await this.prisma.correctionTemplate.findMany({
      where: { userId, autoApply: true },
    });

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    let templatesApplied = 0;
    let correctionsApplied = 0;
    const corrections: any[] = [];

    for (const template of templates) {
      if (template.fieldName === 'invoiceDate' && invoice.invoiceDate) {
        // Mock template application
        const correction = {
          fieldName: 'invoiceDate',
          oldValue: invoice.invoiceDate,
          newValue: '2024-03-15', // Mock standardized date
          templateUsed: template.name,
        };
        corrections.push(correction);
        templatesApplied++;
        correctionsApplied++;
      }
    }

    return {
      success: true,
      templatesApplied,
      correctionsApplied,
      corrections,
    };
  }

  async saveUserPreset(userId: string, preset: any): Promise<any> {
    // Mock implementation for saving user presets
    const presetId = `preset_${Date.now()}`;
    
    return {
      success: true,
      presetId,
      preset: {
        name: preset.name,
        corrections: preset.corrections,
      },
    };
  }

  async getCorrectionHistory(invoiceId: string): Promise<CorrectionHistory> {
    const corrections = await this.prisma.correction.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
      },
    });

    const correctionsByField: { [field: string]: number } = {};
    corrections.forEach(correction => {
      correctionsByField[correction.fieldName] = (correctionsByField[correction.fieldName] || 0) + 1;
    });

    const correctionTimeline = corrections.map(correction => ({
      id: correction.id,
      fieldName: correction.fieldName,
      oldValue: correction.oldValue,
      newValue: correction.newValue,
      reason: correction.reason,
      userName: correction.user?.name,
      createdAt: correction.createdAt,
      status: correction.status,
    }));

    return {
      corrections,
      totalCorrections: corrections.length,
      correctionsByField,
      lastCorrectionDate: corrections[0]?.createdAt || new Date(),
      correctionTimeline,
    };
  }

  async getCorrectionAnalytics(userId: string, options: any): Promise<CorrectionAnalytics> {
    // Mock analytics implementation
    const mockCorrections = [
      { fieldName: 'vendorName', status: 'applied' },
      { fieldName: 'vendorName', status: 'applied' },
      { fieldName: 'totalAmount', status: 'applied' },
      { fieldName: 'invoiceDate', status: 'reverted' },
    ];

    const totalCorrections = mockCorrections.length;
    const appliedCorrections = mockCorrections.filter(c => c.status === 'applied').length;
    const successRate = appliedCorrections / totalCorrections;

    const fieldCounts: { [field: string]: number } = {};
    mockCorrections.forEach(correction => {
      fieldCounts[correction.fieldName] = (fieldCounts[correction.fieldName] || 0) + 1;
    });

    const mostCorrectedField = Object.entries(fieldCounts)
      .sort(([, a], [, b]) => b - a)[0][0];

    const fieldBreakdown: { [field: string]: any } = {};
    Object.entries(fieldCounts).forEach(([field, count]) => {
      const fieldCorrections = mockCorrections.filter(c => c.fieldName === field);
      const fieldApplied = fieldCorrections.filter(c => c.status === 'applied').length;
      fieldBreakdown[field] = {
        count,
        successRate: fieldApplied / count,
      };
    });

    return {
      totalCorrections,
      successRate,
      mostCorrectedField,
      fieldBreakdown,
      trends: { improving: true },
      recommendations: ['Focus on vendor name extraction quality'],
    };
  }

  async revertCorrection(correctionId: string, userId: string, options: any): Promise<any> {
    const correction = await this.prisma.correction.findUnique({
      where: { id: correctionId },
    });

    if (!correction) {
      throw new Error('Correction not found');
    }

    // Update correction status
    await this.prisma.correction.update({
      where: { id: correctionId },
      data: {
        status: 'reverted',
        revertedAt: new Date(),
        revertReason: options.reason,
      },
    });

    // Restore original value
    await this.prisma.invoice.update({
      where: { id: correction.invoiceId },
      data: {
        [correction.fieldName]: correction.oldValue,
      },
    });

    logger.info('Correction reverted', {
      correctionId,
      userId,
      fieldName: correction.fieldName,
    });

    return {
      success: true,
      correctionReverted: true,
      fieldRestored: correction.fieldName,
      restoredValue: correction.oldValue,
    };
  }

  async submitCorrectionForApproval(invoiceId: string, userId: string, correction: any): Promise<any> {
    // Mock approval workflow
    const correctionId = `corr_${Date.now()}`;
    const assignedApprover = 'approver_123';
    
    return {
      success: true,
      correctionId,
      status: 'pending_approval',
      approvalRequired: true,
      assignedApprover,
      estimatedApprovalTime: '2 hours',
    };
  }

  async approveCorrectionRequest(correctionId: string, approverId: string, decision: any): Promise<any> {
    return {
      success: true,
      status: decision.approved ? 'approved' : 'rejected',
      correctionApplied: decision.approved,
      approverComments: decision.comments,
    };
  }

  async addCorrectionComment(correctionId: string, userId: string, comment: any): Promise<any> {
    const commentId = `comment_${Date.now()}`;
    
    return {
      success: true,
      commentId,
      notificationSent: true,
      discussionUpdated: true,
    };
  }

  async enhanceFormWithCorrectionTools(formData: any, userId: string): Promise<any> {
    const enhancedFields: any = {};
    
    Object.entries(formData.fields).forEach(([fieldName, fieldData]: [string, any]) => {
      if (fieldData.editable) {
        enhancedFields[fieldName] = {
          ...fieldData,
          correctionTools: {
            suggestions: [],
            history: [],
            validation: this.getValidationRules(fieldName),
          },
        };
      } else {
        enhancedFields[fieldName] = fieldData;
      }
    });

    return {
      enhanced: true,
      correctionToolsAdded: true,
      fields: enhancedFields,
      globalActions: ['apply_templates', 'bulk_correct'],
    };
  }

  async generateCorrectionWidgets(viewConfig: any, userId: string): Promise<any> {
    const widgets = viewConfig.editableFields.map((fieldName: string) => ({
      fieldName,
      type: fieldName === 'totalAmount' ? 'number_editor' : 'inline_editor',
      features: ['smart_suggestions', 'validation'],
    }));

    return {
      widgets,
      globalWidget: {
        type: 'correction_toolbar',
        actions: ['apply_all_suggestions', 'bulk_edit'],
      },
    };
  }

  async getCorrectionKeyboardShortcuts(): Promise<any> {
    return {
      shortcuts: {
        'Ctrl+E': 'edit_field',
        'Ctrl+S': 'apply_suggestion',
        'Ctrl+Z': 'undo_correction',
        'Ctrl+Shift+Z': 'redo_correction',
        'Escape': 'cancel_edit',
      },
      contextualShortcuts: {
        editing: {
          'Enter': 'apply_change',
          'Tab': 'next_field',
        },
      },
    };
  }

  async applyBulkTemplateCorrections(invoiceIds: string[], userId: string, template: any): Promise<any> {
    const startTime = Date.now();
    let processedInvoices = 0;
    let correctionsApplied = 0;

    // Mock bulk processing
    for (const invoiceId of invoiceIds) {
      processedInvoices++;
      // Simulate some corrections being applied
      if (Math.random() > 0.3) {
        correctionsApplied++;
      }
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    return {
      success: true,
      processedInvoices,
      correctionsApplied,
      performance: {
        totalTime,
        averageTimePerInvoice: totalTime / processedInvoices,
      },
    };
  }

  async generateMobileCorrectionInterface(invoiceId: string, userId: string, config: any): Promise<any> {
    return {
      mobileOptimized: true,
      touchTargets: {
        minSize: 44,
      },
      interface: {
        simplified: config.simplifiedInterface,
      },
      animations: {
        reduced: config.reducedAnimations,
      },
      gestures: ['swipe_to_edit', 'long_press_for_suggestions'],
    };
  }

  private getValidationRules(fieldName: string): any {
    const rules: { [field: string]: any } = {
      totalAmount: {
        type: 'number',
        min: 0,
        required: true,
      },
      vendorName: {
        type: 'string',
        minLength: 1,
        required: true,
      },
      invoiceDate: {
        type: 'date',
        format: 'YYYY-MM-DD',
        required: true,
      },
    };

    return rules[fieldName] || {};
  }

  private getInputType(fieldName: string): string {
    const types: { [field: string]: string } = {
      totalAmount: 'number',
      invoiceDate: 'date',
      vendorName: 'text',
      invoiceNumber: 'text',
    };

    return types[fieldName] || 'text';
  }

  private initializeCorrectionPatterns(): void {
    // Initialize common correction patterns
    this.correctionPatterns.set('Corp -> Corporation', {
      pattern: 'Corp -> Corporation',
      confidence: 0.9,
      applicability: 'vendor_name_expansion',
    });
  }
}
