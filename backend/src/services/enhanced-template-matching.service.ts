import { EnhancedConfidenceService } from './enhanced-confidence.service';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

interface TemplatePattern {
  field: string;
  patterns: string[];
  weight: number;
  language?: string;
}

interface Template {
  id: string;
  name: string;
  templateType: string;
  patterns: { [key: string]: string[] };
  successRate: number;
  usageCount: number;
  language?: string;
  recentPerformance?: number[];
}

interface TemplateMatch {
  templateType: string;
  confidence: number;
  selectedTemplate?: Template;
  similarityScore: number;
  learnedPatterns?: TemplatePattern[];
  adaptedPatterns?: { [key: string]: string[] };
  suggestNewTemplate?: boolean;
  newTemplatePatterns?: { [key: string]: string[] };
  performanceMetrics?: {
    usageCount: number;
    successRate: number;
    averageConfidence: number;
  };
  historicalConfidenceBoost?: number;
  detectedLanguage?: string;
  language?: string;
}

export class EnhancedTemplateMatchingService extends EnhancedConfidenceService {
  private readonly templateTypes = [
    'standard_invoice',
    'receipt',
    'service_invoice',
    'product_invoice',
    'credit_note',
    'purchase_order',
  ];

  private readonly templateSignatures = new Map([
    ['standard_invoice', {
      requiredFields: ['invoiceNumber', 'invoiceDate', 'vendorName', 'totalAmount'],
      optionalFields: ['dueDate', 'customerName', 'lineItems', 'subtotal', 'taxAmount'],
      keyPhrases: ['invoice', 'bill to', 'from', 'total amount', 'due date'],
      structure: 'header_vendor_customer_items_totals',
    }],
    ['receipt', {
      requiredFields: ['vendorName', 'totalAmount'],
      optionalFields: ['invoiceDate', 'lineItems', 'taxAmount'],
      keyPhrases: ['receipt', 'store', 'thank you', 'payment'],
      structure: 'header_items_total_payment',
    }],
    ['service_invoice', {
      requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
      optionalFields: ['customerName', 'lineItems', 'hourlyRate'],
      keyPhrases: ['professional services', 'consulting', 'hours', 'rate'],
      structure: 'header_services_hours_total',
    }],
  ]);

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async extractFields(text: string, options: any): Promise<any> {
    // First extract fields using enhanced confidence scoring
    const result = await super.extractFields(text, options);
    
    // Then apply template matching
    const templateMatch = await this.performTemplateMatching(result, text, options);
    
    // Enhance extraction based on template match
    if (templateMatch.selectedTemplate) {
      const enhancedResult = await this.enhanceExtractionWithTemplate(result, templateMatch.selectedTemplate, text);
      Object.assign(result, enhancedResult);
    }
    
    // Add template matching results
    result.templateMatch = templateMatch;

    // Learn from this extraction if enabled
    if (options.enableLearning) {
      await this.learnFromExtraction(result, templateMatch, options);
    }

    logger.info('Enhanced template matching completed', {
      templateType: templateMatch.templateType,
      confidence: templateMatch.confidence,
      selectedTemplate: templateMatch.selectedTemplate?.id,
      similarityScore: templateMatch.similarityScore,
      detectedLanguage: templateMatch.detectedLanguage,
    });

    return result;
  }

  private async performTemplateMatching(result: any, text: string, options: any): Promise<TemplateMatch> {
    // Detect document language
    const detectedLanguage = options.autoDetectLanguage ? this.detectLanguage(text) : (options.language || 'en');
    
    // Get available templates
    const availableTemplates = await this.getAvailableTemplates(options.type, detectedLanguage);
    
    // Calculate template similarities
    const templateScores = await this.calculateTemplateSimilarities(result, text, availableTemplates);
    
    // Select best matching template
    const bestMatch = this.selectBestTemplate(templateScores, options);
    
    // Determine template type
    const templateType = this.determineTemplateType(result, text);
    
    // Calculate overall confidence
    const confidence = this.calculateTemplateConfidence(bestMatch, templateScores, result);
    
    const templateMatch: TemplateMatch = {
      templateType,
      confidence,
      selectedTemplate: bestMatch?.template,
      similarityScore: bestMatch?.score || 0,
      detectedLanguage,
      language: detectedLanguage,
    };

    // Add performance metrics if tracking is enabled
    if (options.trackPerformance && bestMatch?.template) {
      templateMatch.performanceMetrics = await this.getTemplatePerformanceMetrics(bestMatch.template.id);
    }

    // Add historical confidence boost if enabled
    if (options.useHistoricalPerformance && bestMatch?.template) {
      templateMatch.historicalConfidenceBoost = this.calculateHistoricalConfidenceBoost(bestMatch.template);
    }

    // Check if new template should be suggested
    if (options.createNewTemplates && (!bestMatch || bestMatch.score < 0.7)) {
      templateMatch.suggestNewTemplate = true;
      templateMatch.newTemplatePatterns = this.extractNewTemplatePatterns(result, text);
    }

    return templateMatch;
  }

  private async getAvailableTemplates(documentType: string, language: string): Promise<Template[]> {
    try {
      const templates = await this.prisma.template.findMany({
        where: {
          OR: [
            { templateType: documentType },
            { templateType: 'generic' },
          ],
          AND: [
            {
              OR: [
                { language: language },
                { language: null }, // Language-agnostic templates
              ],
            },
          ],
        },
        orderBy: [
          { successRate: 'desc' },
          { usageCount: 'desc' },
        ],
      });

      const templateArray = Array.isArray(templates) ? templates as Template[] : [];
      return templateArray.length > 0 ? templateArray : this.getBuiltInTemplates(documentType, language);
    } catch (error) {
      logger.warn('Failed to fetch templates from database', { error });
      return this.getBuiltInTemplates(documentType, language);
    }
  }

  private getBuiltInTemplates(documentType: string, language: string): Template[] {
    // Return built-in templates as fallback
    const builtInTemplates: Template[] = [
      {
        id: 'builtin-standard-invoice',
        name: 'Standard Invoice',
        templateType: 'standard_invoice',
        patterns: {
          invoiceNumber: ['Invoice Number:', 'Invoice #:', 'Invoice:', 'Ref:'],
          totalAmount: ['Total:', 'Total Amount:', 'Grand Total:', 'Amount Due:'],
          invoiceDate: ['Date:', 'Invoice Date:', 'Issued:'],
          vendorName: ['From:', 'Vendor:', 'Bill From:'],
          customerName: ['To:', 'Customer:', 'Bill To:'],
        },
        successRate: 0.85,
        usageCount: 0,
        language,
      },
      {
        id: 'builtin-receipt',
        name: 'Receipt',
        templateType: 'receipt',
        patterns: {
          vendorName: ['Store:', 'Shop:', 'Merchant:'],
          totalAmount: ['Total:', 'Amount:', 'Sum:'],
          invoiceDate: ['Date:', 'Time:', 'Transaction Date:'],
        },
        successRate: 0.80,
        usageCount: 0,
        language,
      },
    ];

    return builtInTemplates.filter(t => t.templateType === documentType || documentType === 'invoice');
  }

  private async calculateTemplateSimilarities(result: any, text: string, templates: Template[]): Promise<Array<{ template: Template; score: number }>> {
    const scores: Array<{ template: Template; score: number }> = [];

    for (const template of templates) {
      const score = this.calculateTemplateSimilarity(result, text, template);
      scores.push({ template, score });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  private calculateTemplateSimilarity(result: any, text: string, template: Template): number {
    let totalScore = 0;
    let totalWeight = 0;

    // Check field pattern matches
    for (const [field, patterns] of Object.entries(template.patterns)) {
      const fieldValue = result[field];
      const weight = this.getFieldWeight(field);
      
      if (fieldValue !== null && fieldValue !== undefined) {
        // Field was extracted - check if it matches template patterns
        const patternMatch = this.checkPatternMatch(text, patterns);
        totalScore += patternMatch * weight;
      }
      
      totalWeight += weight;
    }

    // Check structural similarity
    const structuralScore = this.calculateStructuralSimilarity(text, template);
    totalScore += structuralScore * 0.3;
    totalWeight += 0.3;

    // Check language compatibility
    if (template.language) {
      const detectedLanguage = this.detectLanguage(text);
      if (detectedLanguage === template.language) {
        totalScore += 0.2;
      }
      totalWeight += 0.2;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private checkPatternMatch(text: string, patterns: string[]): number {
    const textLower = text.toLowerCase();
    let bestMatch = 0;

    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase();
      if (textLower.includes(patternLower)) {
        // Exact match
        bestMatch = Math.max(bestMatch, 1.0);
      } else {
        // Check for fuzzy match
        const similarity = this.calculateStringSimilarity(textLower, patternLower);
        if (similarity > 0.7) {
          bestMatch = Math.max(bestMatch, similarity * 0.8);
        }
      }
    }

    return bestMatch;
  }

  private calculateStructuralSimilarity(text: string, template: Template): number {
    const signature = this.templateSignatures.get(template.templateType);
    if (!signature) return 0.5;

    let score = 0;
    const textLower = text.toLowerCase();

    // Check for key phrases
    for (const phrase of signature.keyPhrases) {
      if (textLower.includes(phrase)) {
        score += 0.2;
      }
    }

    // Check document structure
    const hasHeader = /^[A-Z\s]{5,}/.test(text.trim());
    const hasLineItems = /\d+\.\s+.+\s+\$[\d,\.]+/.test(text);
    const hasTotals = /total|sum|amount/i.test(text);

    if (hasHeader) score += 0.2;
    if (hasLineItems && signature.structure.includes('items')) score += 0.3;
    if (hasTotals) score += 0.2;

    return Math.min(score, 1.0);
  }

  private selectBestTemplate(templateScores: Array<{ template: Template; score: number }>, options: any): { template: Template; score: number } | null {
    if (templateScores.length === 0) return null;

    const bestScore = templateScores[0];
    
    // Consider success rate and usage count in selection
    if (options.autoSelectTemplate) {
      const weightedScores = templateScores.map(({ template, score }) => ({
        template,
        score,
        weightedScore: score * 0.7 + template.successRate * 0.2 + Math.min(template.usageCount / 100, 1) * 0.1,
      }));

      weightedScores.sort((a, b) => b.weightedScore - a.weightedScore);
      return { template: weightedScores[0].template, score: weightedScores[0].score };
    }

    return bestScore.score > 0.5 ? bestScore : null;
  }

  private determineTemplateType(result: any, text: string): string {
    const textLower = text.toLowerCase();
    
    // Check for explicit type indicators
    if (textLower.includes('receipt')) return 'receipt';
    if (textLower.includes('credit note') || textLower.includes('credit memo')) return 'credit_note';
    if (textLower.includes('purchase order')) return 'purchase_order';
    if (textLower.includes('professional services') || textLower.includes('consulting')) return 'service_invoice';
    
    // Check field patterns
    if (result.lineItems && result.lineItems.length > 0) {
      const hasProducts = result.lineItems.some((item: any) => item.description && !item.description.toLowerCase().includes('hour'));
      const hasServices = result.lineItems.some((item: any) => item.description && (item.description.toLowerCase().includes('hour') || item.description.toLowerCase().includes('service')));
      
      if (hasServices && !hasProducts) return 'service_invoice';
      if (hasProducts) return 'product_invoice';
    }
    
    // Default to standard invoice
    return 'standard_invoice';
  }

  private calculateTemplateConfidence(bestMatch: { template: Template; score: number } | null, allScores: Array<{ template: Template; score: number }>, result: any): number {
    if (!bestMatch) return 0.3;

    let confidence = bestMatch.score;

    // Boost confidence if there's a clear winner
    if (allScores.length > 1) {
      const secondBest = allScores[1];
      const gap = bestMatch.score - secondBest.score;
      if (gap > 0.3) {
        confidence += 0.1; // Clear winner bonus
      }
    }

    // Boost confidence based on template success rate
    confidence = confidence * 0.8 + bestMatch.template.successRate * 0.2;

    return Math.min(confidence, 1.0);
  }

  private getFieldWeight(field: string): number {
    const weights: { [key: string]: number } = {
      invoiceNumber: 1.0,
      totalAmount: 1.0,
      vendorName: 0.8,
      customerName: 0.7,
      invoiceDate: 0.8,
      dueDate: 0.6,
      lineItems: 0.9,
      subtotal: 0.7,
      taxAmount: 0.7,
    };

    return weights[field] || 0.5;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private detectLanguage(text: string): string {
    const languageKeywords = {
      'en': ['invoice', 'total', 'amount', 'date', 'due', 'bill', 'from', 'to'],
      'es': ['factura', 'total', 'importe', 'fecha', 'vencimiento', 'de', 'para'],
      'de': ['rechnung', 'gesamt', 'betrag', 'datum', 'fällig', 'von', 'an'],
      'fr': ['facture', 'total', 'montant', 'date', 'échéance', 'de', 'à'],
    };

    const textLower = text.toLowerCase();
    let maxScore = 0;
    let detectedLang = 'en';

    for (const [lang, keywords] of Object.entries(languageKeywords)) {
      const score = keywords.reduce((acc, keyword) => {
        return acc + (textLower.includes(keyword) ? 1 : 0);
      }, 0);
      
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    return detectedLang;
  }

  private async enhanceExtractionWithTemplate(result: any, template: Template, text: string): Promise<any> {
    const enhancements: any = {};

    // Try to extract missing fields using template patterns
    for (const [field, patterns] of Object.entries(template.patterns)) {
      if (!result[field] || result[field] === null || result[field] === undefined) {
        const extractedValue = this.extractFieldWithPatterns(text, patterns, field);
        if (extractedValue) {
          enhancements[field] = extractedValue;
          
          // Update confidence for enhanced fields
          if (!result.confidence) result.confidence = {};
          result.confidence[field] = 0.7; // Template-based extraction confidence
        }
      }
    }

    return enhancements;
  }

  private extractFieldWithPatterns(text: string, patterns: string[], field: string): any {
    for (const pattern of patterns) {
      const regex = new RegExp(`${pattern}\\s*:?\\s*([^\\n\\r]+)`, 'i');
      const match = text.match(regex);
      
      if (match && match[1]) {
        const value = match[1].trim();
        return this.parseFieldValue(value, field);
      }
    }
    
    return null;
  }

  private parseFieldValue(value: string, field: string): any {
    switch (field) {
      case 'totalAmount':
      case 'taxAmount':
      case 'subtotal':
        const numericValue = parseFloat(value.replace(/[^\d.,]/g, ''));
        return isNaN(numericValue) ? null : numericValue;
      
      case 'invoiceDate':
      case 'dueDate':
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      
      default:
        return value;
    }
  }

  private async getTemplatePerformanceMetrics(templateId: string): Promise<any> {
    // This would typically query the database for performance metrics
    return {
      usageCount: 1,
      successRate: 0.85,
      averageConfidence: 0.82,
    };
  }

  private calculateHistoricalConfidenceBoost(template: Template): number {
    if (!template.recentPerformance || template.recentPerformance.length === 0) {
      return 0;
    }

    const avgRecentPerformance = template.recentPerformance.reduce((sum, perf) => sum + perf, 0) / template.recentPerformance.length;
    const boost = (avgRecentPerformance - 0.5) * 0.2; // Max boost of 0.1
    
    return Math.max(0, Math.min(boost, 0.1));
  }

  private extractNewTemplatePatterns(result: any, text: string): { [key: string]: string[] } {
    const patterns: { [key: string]: string[] } = {};
    
    // Extract patterns for successfully extracted fields
    for (const [field, value] of Object.entries(result)) {
      if (field === 'confidence' || field === 'rawText' || field === 'validation' || !value) continue;
      
      const fieldPatterns = this.findPatternsForField(text, field, value);
      if (fieldPatterns.length > 0) {
        patterns[field] = fieldPatterns;
      }
    }
    
    return patterns;
  }

  private findPatternsForField(text: string, field: string, value: any): string[] {
    const patterns: string[] = [];
    const valueStr = String(value);
    
    // Find the value in text and extract the preceding label
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes(valueStr)) {
        const parts = line.split(valueStr);
        if (parts.length > 1 && parts[0].trim()) {
          const label = parts[0].trim().replace(/[^\w\s]/g, '').trim();
          if (label.length > 0 && label.length < 50) {
            patterns.push(label + ':');
          }
        }
      }
    }
    
    return patterns;
  }

  private async learnFromExtraction(result: any, templateMatch: TemplateMatch, options: any): Promise<void> {
    // This would implement learning logic to improve templates
    logger.info('Learning from extraction', {
      templateType: templateMatch.templateType,
      confidence: templateMatch.confidence,
      extractedFields: Object.keys(result).filter(k => k !== 'confidence' && k !== 'rawText' && k !== 'validation'),
    });
  }
}
