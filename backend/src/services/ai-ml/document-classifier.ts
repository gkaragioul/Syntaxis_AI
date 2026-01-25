/**
 * Document Classifier
 * 
 * TDD Phase: GREEN - Minimal implementation to make document classification tests pass
 * Enhancement: Advanced AI/ML Features - Document Classification
 * 
 * This class provides intelligent document classification with:
 * - Multi-type document classification (invoice, receipt, contract, etc.)
 * - Confidence scoring and alternative classifications
 * - Feature extraction and field extraction
 * - Machine learning model integration
 */

import { MLModelManager } from './ml-model-manager';
import { FeatureExtractor } from './feature-extractor';

export interface DocumentInput {
  text: string;
  metadata: {
    filename: string;
    fileSize: number;
    pageCount: number;
  };
}

export interface ClassificationResult {
  documentType: string;
  confidence: number;
  alternativeTypes: Array<{
    type: string;
    confidence: number;
  }>;
  features: Record<string, boolean>;
  extractedFields: Record<string, any>;
  processingTime: number;
  modelVersion: string;
  ambiguityScore?: number;
  recommendedAction?: string;
}

export class DocumentClassifier {
  private isInitialized: boolean = false;
  private mlModelManager: MLModelManager;
  private featureExtractor: FeatureExtractor;
  private documentTypes = ['invoice', 'receipt', 'contract', 'payment_confirmation', 'other'];

  constructor() {
    this.mlModelManager = new MLModelManager();
    this.featureExtractor = new FeatureExtractor();
  }

  /**
   * Initialize document classifier
   * GREEN: Basic initialization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.mlModelManager.initialize();
    await this.featureExtractor.initialize();
    this.isInitialized = true;
  }

  /**
   * Classify document based on text content
   * GREEN: Main classification logic
   */
  async classifyDocument(input: DocumentInput): Promise<ClassificationResult> {
    const startTime = Date.now();

    // Extract features from document
    const features = await this.featureExtractor.extractFeatures(input.text);
    
    // Classify document type
    const classification = this.classifyByRules(input.text, features);
    
    // Extract fields based on classification
    const extractedFields = this.extractFields(input.text, classification.documentType);
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Handle ambiguous cases
    const ambiguityScore = this.calculateAmbiguityScore(classification.alternativeTypes);
    const recommendedAction = this.getRecommendedAction(classification.confidence, ambiguityScore);

    return {
      documentType: classification.documentType,
      confidence: classification.confidence,
      alternativeTypes: classification.alternativeTypes,
      features: features.booleanFeatures,
      extractedFields,
      processingTime,
      modelVersion: '1.0.0',
      ambiguityScore,
      recommendedAction
    };
  }

  /**
   * Classify document using rule-based approach
   * GREEN: Rule-based classification
   */
  private classifyByRules(text: string, features: any): {
    documentType: string;
    confidence: number;
    alternativeTypes: Array<{ type: string; confidence: number }>;
  } {
    const scores: Record<string, number> = {};
    
    // Invoice classification rules
    scores.invoice = this.calculateInvoiceScore(text, features);
    
    // Receipt classification rules
    scores.receipt = this.calculateReceiptScore(text, features);
    
    // Contract classification rules
    scores.contract = this.calculateContractScore(text, features);
    
    // Payment confirmation rules
    scores.payment_confirmation = this.calculatePaymentConfirmationScore(text, features);
    
    // Other documents
    scores.other = 0.1; // Base score for unknown documents

    // Sort by score
    const sortedTypes = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([type, score]) => ({ type, confidence: Math.min(score, 1.0) }));

    const topType = sortedTypes[0];
    const alternativeTypes = sortedTypes.slice(1, 4); // Top 3 alternatives

    return {
      documentType: topType.type,
      confidence: topType.confidence,
      alternativeTypes
    };
  }

  /**
   * Calculate invoice classification score
   * GREEN: Invoice scoring logic
   */
  private calculateInvoiceScore(text: string, features: any): number {
    let score = 0;
    
    // Check for invoice keywords
    if (/\binvoice\b/i.test(text)) score += 0.3;
    if (/invoice\s*number/i.test(text)) score += 0.2;
    if (/bill\s*to/i.test(text)) score += 0.15;
    if (/due\s*date/i.test(text)) score += 0.15;
    if (/payment\s*terms/i.test(text)) score += 0.1;
    
    // Check for amount patterns
    if (/total[:\s]*\$[\d,]+\.?\d*/i.test(text)) score += 0.2;
    if (/subtotal/i.test(text)) score += 0.1;
    if (/tax/i.test(text)) score += 0.1;
    
    // Check for line items
    if (features.hasLineItems) score += 0.15;
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate receipt classification score
   * GREEN: Receipt scoring logic
   */
  private calculateReceiptScore(text: string, features: any): number {
    let score = 0;
    
    // Check for receipt keywords
    if (/\breceipt\b/i.test(text)) score += 0.3;
    if (/transaction\s*id/i.test(text)) score += 0.2;
    if (/store\s*#?\d+/i.test(text)) score += 0.15;
    
    // Check for store names (common patterns)
    if (/walmart|target|costco|kroger|safeway/i.test(text)) score += 0.2;
    
    // Check for payment methods
    if (/visa|mastercard|amex|cash|debit|credit/i.test(text)) score += 0.15;
    
    // Check for timestamp patterns
    if (/\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/i.test(text)) score += 0.1;
    
    // Check for "thank you" message
    if (/thank\s*you/i.test(text)) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate contract classification score
   * GREEN: Contract scoring logic
   */
  private calculateContractScore(text: string, features: any): number {
    let score = 0;
    
    // Check for contract keywords
    if (/\b(agreement|contract)\b/i.test(text)) score += 0.3;
    if (/this\s+(agreement|contract)/i.test(text)) score += 0.2;
    if (/in\s*witness\s*whereof/i.test(text)) score += 0.2;
    
    // Check for legal language
    if (/whereas|hereby|herein|thereof|party|parties/i.test(text)) score += 0.15;
    if (/shall|agrees?\s*to|subject\s*to/i.test(text)) score += 0.1;
    
    // Check for signature blocks
    if (/by:\s*_+|signature|signed/i.test(text)) score += 0.15;
    
    // Check for effective date
    if (/effective\s*date|entered\s*into/i.test(text)) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate payment confirmation score
   * GREEN: Payment confirmation scoring logic
   */
  private calculatePaymentConfirmationScore(text: string, features: any): number {
    let score = 0;
    
    // Check for payment keywords
    if (/payment\s*(confirmation|receipt)/i.test(text)) score += 0.3;
    if (/transaction\s*(id|reference)/i.test(text)) score += 0.2;
    if (/status:\s*completed/i.test(text)) score += 0.2;
    
    // Check for payment methods
    if (/bank\s*transfer|wire\s*transfer|ach/i.test(text)) score += 0.15;
    
    // Check for account references
    if (/account\s*\*+\d+/i.test(text)) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Extract fields based on document type
   * GREEN: Field extraction logic
   */
  private extractFields(text: string, documentType: string): Record<string, any> {
    switch (documentType) {
      case 'invoice':
        return this.extractInvoiceFields(text);
      case 'receipt':
        return this.extractReceiptFields(text);
      case 'contract':
        return this.extractContractFields(text);
      case 'payment_confirmation':
        return this.extractPaymentFields(text);
      default:
        return {};
    }
  }

  /**
   * Extract invoice-specific fields
   * GREEN: Invoice field extraction
   */
  private extractInvoiceFields(text: string): Record<string, any> {
    const fields: Record<string, any> = {};
    
    // Extract invoice number
    const invoiceNumberMatch = text.match(/invoice\s*(?:number|#)?\s*:?\s*([A-Z0-9-]+)/i);
    if (invoiceNumberMatch) {
      fields.invoiceNumber = invoiceNumberMatch[1];
    }
    
    // Extract total amount
    const totalMatch = text.match(/total[:\s]*\$?([\d,]+\.?\d*)/i);
    if (totalMatch) {
      fields.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
    }
    
    // Extract due date
    const dueDateMatch = text.match(/due\s*date[:\s]*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
    if (dueDateMatch) {
      fields.dueDate = this.parseDate(dueDateMatch[1]);
    }
    
    // Extract customer
    const billToMatch = text.match(/bill\s*to[:\s]*([^\n]+)/i);
    if (billToMatch) {
      fields.customer = billToMatch[1].trim();
    }
    
    return fields;
  }

  /**
   * Extract receipt-specific fields
   * GREEN: Receipt field extraction
   */
  private extractReceiptFields(text: string): Record<string, any> {
    const fields: Record<string, any> = {};
    
    // Extract store name (first line often contains store name)
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      fields.storeName = lines[0].trim();
    }
    
    // Extract total amount
    const totalMatch = text.match(/total[:\s]*\$?([\d,]+\.?\d*)/i);
    if (totalMatch) {
      fields.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
    }
    
    // Extract transaction ID
    const transactionMatch = text.match(/transaction\s*(?:id|#)?[:\s]*([A-Z0-9]+)/i);
    if (transactionMatch) {
      fields.transactionId = transactionMatch[1];
    }
    
    // Extract payment method
    const paymentMatch = text.match(/(visa|mastercard|amex|cash|debit|credit)[^$\n]*(\$?[\d,]+\.?\d*)?/i);
    if (paymentMatch) {
      fields.paymentMethod = paymentMatch[0].trim();
    }
    
    // Extract transaction date
    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) {
      fields.transactionDate = this.parseDate(dateMatch[1]);
    }
    
    return fields;
  }

  /**
   * Extract contract-specific fields
   * GREEN: Contract field extraction
   */
  private extractContractFields(text: string): Record<string, any> {
    const fields: Record<string, any> = {};
    
    // Extract contract type
    const contractTypeMatch = text.match(/^([^(\n]+(?:agreement|contract))/im);
    if (contractTypeMatch) {
      fields.contractType = contractTypeMatch[1].trim();
    }
    
    // Extract parties
    const parties: string[] = [];
    const partyMatches = text.matchAll(/between\s+([^,\n]+),?\s*(?:a\s+[^,\n]+,?)?\s*\("?[^"]*"?\)\s*(?:and|,)\s*([^,\n]+)/gi);
    for (const match of partyMatches) {
      parties.push(match[1].trim(), match[2].trim());
    }
    if (parties.length > 0) {
      fields.parties = parties;
    }
    
    // Extract effective date
    const effectiveDateMatch = text.match(/(?:entered\s*into\s*on|effective\s*date[:\s]*)([^,\n]+)/i);
    if (effectiveDateMatch) {
      fields.effectiveDate = this.parseDate(effectiveDateMatch[1]);
    }
    
    // Extract signatories
    const signatories: Array<{ name: string; title: string }> = [];
    const signatureMatches = text.matchAll(/name:\s*([^\n]+)\s*title:\s*([^\n]+)/gi);
    for (const match of signatureMatches) {
      signatories.push({
        name: match[1].trim(),
        title: match[2].trim()
      });
    }
    if (signatories.length > 0) {
      fields.signatories = signatories;
    }
    
    return fields;
  }

  /**
   * Extract payment confirmation fields
   * GREEN: Payment field extraction
   */
  private extractPaymentFields(text: string): Record<string, any> {
    const fields: Record<string, any> = {};
    
    // Extract amount
    const amountMatch = text.match(/amount[:\s]*\$?([\d,]+\.?\d*)/i);
    if (amountMatch) {
      fields.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
    
    // Extract transaction ID
    const transactionMatch = text.match(/transaction\s*(?:id|reference)[:\s]*([A-Z0-9]+)/i);
    if (transactionMatch) {
      fields.transactionId = transactionMatch[1];
    }
    
    return fields;
  }

  /**
   * Parse date string to ISO format
   * GREEN: Date parsing utility
   */
  private parseDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    } catch {
      return dateString; // Return original if parsing fails
    }
  }

  /**
   * Calculate ambiguity score
   * GREEN: Ambiguity calculation
   */
  private calculateAmbiguityScore(alternativeTypes: Array<{ type: string; confidence: number }>): number {
    if (alternativeTypes.length === 0) return 0;
    
    const topAlternative = alternativeTypes[0];
    return topAlternative.confidence; // Higher alternative confidence = higher ambiguity
  }

  /**
   * Get recommended action based on confidence and ambiguity
   * GREEN: Action recommendation
   */
  private getRecommendedAction(confidence: number, ambiguityScore: number): string {
    if (confidence < 0.6) return 'manual_review';
    if (ambiguityScore > 0.4) return 'additional_context_needed';
    return 'accept_classification';
  }

  /**
   * Cleanup document classifier
   * GREEN: Cleanup method
   */
  async cleanup(): Promise<void> {
    await this.mlModelManager.cleanup();
    await this.featureExtractor.cleanup();
    this.isInitialized = false;
  }
}

export default DocumentClassifier;
