/**
 * Invoice Type Detector
 * Automatically detects invoice type based on extracted text and patterns
 * Supports: Standard Invoice, Purchase Order, Receipt, Credit Note, Debit Note
 */

export type InvoiceType = 'standard' | 'purchase_order' | 'receipt' | 'credit_note' | 'debit_note' | 'unknown';

export interface InvoiceTypeDetectionResult {
  type: InvoiceType;
  confidence: number;
  indicators: string[];
}

export class InvoiceTypeDetector {
  /**
   * Detect invoice type from extracted text
   */
  static detectType(text: string): InvoiceTypeDetectionResult {
    const lowerText = text.toLowerCase();
    const indicators: string[] = [];
    let scores: Record<InvoiceType, number> = {
      standard: 0,
      purchase_order: 0,
      receipt: 0,
      credit_note: 0,
      debit_note: 0,
      unknown: 0,
    };

    // Purchase Order indicators
    if (this.hasPattern(lowerText, ['purchase order', 'po number', 'po#', 'order date'])) {
      scores.purchase_order += 3;
      indicators.push('Purchase Order keywords found');
    }

    // Receipt indicators
    if (this.hasPattern(lowerText, ['receipt', 'transaction', 'payment received', 'thank you'])) {
      scores.receipt += 2;
      indicators.push('Receipt keywords found');
    }

    // Credit Note indicators
    if (this.hasPattern(lowerText, ['credit note', 'credit memo', 'refund', 'return'])) {
      scores.credit_note += 3;
      indicators.push('Credit Note keywords found');
    }

    // Debit Note indicators
    if (this.hasPattern(lowerText, ['debit note', 'debit memo', 'additional charge'])) {
      scores.debit_note += 3;
      indicators.push('Debit Note keywords found');
    }

    // Standard Invoice indicators
    if (this.hasPattern(lowerText, ['invoice', 'inv#', 'invoice number', 'bill to', 'ship to'])) {
      scores.standard += 2;
      indicators.push('Standard Invoice keywords found');
    }

    // Check for line items (common in invoices)
    if (this.hasLineItems(text)) {
      scores.standard += 1;
      scores.purchase_order += 1;
      indicators.push('Line items detected');
    }

    // Check for amounts and totals
    if (this.hasAmounts(text)) {
      scores.standard += 1;
      scores.receipt += 1;
      indicators.push('Amount fields detected');
    }

    // Find the type with highest score
    let detectedType: InvoiceType = 'unknown';
    let maxScore = 0;

    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedType = type as InvoiceType;
      }
    }

    // If no clear match, default to standard
    if (detectedType === 'unknown' && maxScore === 0) {
      detectedType = 'standard';
      maxScore = 1;
    }

    const confidence = Math.min(maxScore / 5, 1); // Normalize to 0-1

    return {
      type: detectedType,
      confidence,
      indicators,
    };
  }

  /**
   * Check if text contains any of the patterns
   */
  private static hasPattern(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }

  /**
   * Check if text contains line items (description, quantity, price)
   */
  private static hasLineItems(text: string): boolean {
    const patterns = [
      /qty|quantity|qnt/i,
      /unit price|price|rate/i,
      /description|item|product/i,
    ];
    return patterns.filter(p => p.test(text)).length >= 2;
  }

  /**
   * Check if text contains amount fields
   */
  private static hasAmounts(text: string): boolean {
    const patterns = [
      /total|subtotal|amount/i,
      /tax|vat|gst/i,
      /\$\s*\d+/,
    ];
    return patterns.filter(p => p.test(text)).length >= 2;
  }

  /**
   * Get all supported invoice types
   */
  static getSupportedTypes(): InvoiceType[] {
    return ['standard', 'purchase_order', 'receipt', 'credit_note', 'debit_note'];
  }

  /**
   * Get human-readable type name
   */
  static getTypeName(type: InvoiceType): string {
    const names: Record<InvoiceType, string> = {
      standard: 'Standard Invoice',
      purchase_order: 'Purchase Order',
      receipt: 'Receipt',
      credit_note: 'Credit Note',
      debit_note: 'Debit Note',
      unknown: 'Unknown',
    };
    return names[type];
  }
}

export default InvoiceTypeDetector;

