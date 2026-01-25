/**
 * Feature Extractor
 * 
 * TDD Phase: GREEN - Minimal implementation for feature extraction
 * Enhancement: Advanced AI/ML Features
 */

export interface ExtractedFeatures {
  booleanFeatures: Record<string, boolean>;
  numericFeatures: Record<string, number>;
  textFeatures: Record<string, any>;
  hasLineItems: boolean;
}

export class FeatureExtractor {
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async extractFeatures(text: string): Promise<ExtractedFeatures> {
    const booleanFeatures: Record<string, boolean> = {
      hasInvoiceNumber: /invoice\s*(?:number|#)/i.test(text),
      hasDueDate: /due\s*date/i.test(text),
      hasLineItems: this.hasLineItems(text),
      hasTotalAmount: /total[:\s]*\$?[\d,]+\.?\d*/i.test(text),
      hasPaymentTerms: /payment\s*terms/i.test(text),
      hasStoreName: /store|shop|market/i.test(text),
      hasTransactionId: /transaction\s*(?:id|#)/i.test(text),
      hasSignature: /signature|signed|by:/i.test(text),
      hasLegalLanguage: /whereas|hereby|agreement|contract/i.test(text),
      hasParties: /between\s+[^,\n]+\s+and\s+[^,\n]+/i.test(text),
      hasSignatureBlocks: /by:\s*_+|name:|title:/i.test(text),
      hasTermsAndConditions: /terms\s*and\s*conditions|subject\s*to/i.test(text),
      hasEffectiveDate: /effective\s*date|entered\s*into/i.test(text),
      hasPaymentMethod: /visa|mastercard|cash|debit|credit/i.test(text),
      hasTimestamp: /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/i.test(text)
    };

    const numericFeatures: Record<string, number> = {
      wordCount: text.split(/\s+/).length,
      lineCount: text.split('\n').length,
      characterCount: text.length,
      numberCount: (text.match(/\d+/g) || []).length,
      currencyCount: (text.match(/\$[\d,]+\.?\d*/g) || []).length
    };

    const textFeatures = {
      hasNumbers: /\d/.test(text),
      hasAmounts: /\$[\d,]+\.?\d*/.test(text),
      hasAddresses: /\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|drive|dr)/i.test(text),
      keywordMatches: this.extractKeywords(text)
    };

    return {
      booleanFeatures,
      numericFeatures,
      textFeatures,
      hasLineItems: booleanFeatures.hasLineItems
    };
  }

  private hasLineItems(text: string): boolean {
    // Look for table-like structures or itemized lists
    const lines = text.split('\n');
    let itemizedLines = 0;
    
    for (const line of lines) {
      // Check if line looks like an item (has description and amount)
      if (/^[^$\n]*\$[\d,]+\.?\d*\s*$/.test(line.trim()) || 
          /^[^$\n]+\s+\$?[\d,]+\.?\d*\s*$/.test(line.trim())) {
        itemizedLines++;
      }
    }
    
    return itemizedLines >= 2; // At least 2 line items
  }

  private extractKeywords(text: string): string[] {
    const keywords = [];
    const invoiceKeywords = ['invoice', 'bill', 'total', 'due date', 'payment'];
    const receiptKeywords = ['receipt', 'transaction', 'store', 'thank you'];
    const contractKeywords = ['agreement', 'contract', 'party', 'signature'];
    
    const allKeywords = [...invoiceKeywords, ...receiptKeywords, ...contractKeywords];
    
    for (const keyword of allKeywords) {
      if (new RegExp(keyword, 'i').test(text)) {
        keywords.push(keyword);
      }
    }
    
    return keywords;
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false;
  }
}

export default FeatureExtractor;
