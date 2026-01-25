// @ts-nocheck

import { FieldExtractionService } from './field.service';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

interface EnhancedFieldPattern {
  id?: string;
  field: string;
  patterns: string[];
  regexPatterns?: string[];
  priority: number;
  language?: string;
  fuzzyMatch?: boolean;
  contextRequired?: boolean;
}

interface CurrencyInfo {
  symbol: string;
  code: string;
  decimalSeparator: string;
  thousandsSeparator: string;
}

interface ExtractionContext {
  section?: 'header' | 'body' | 'footer' | 'vendor' | 'customer' | 'items';
  precedingText?: string;
  followingText?: string;
  lineNumber?: number;
}

export class EnhancedFieldExtractionService extends FieldExtractionService {
  private readonly currencyMap: Map<string, CurrencyInfo> = new Map([
    [
      '$',
      {
        symbol: '$',
        code: 'USD',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      '€',
      {
        symbol: '€',
        code: 'EUR',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
    ],
    [
      '£',
      {
        symbol: '£',
        code: 'GBP',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      '¥',
      {
        symbol: '¥',
        code: 'JPY',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
    [
      '₹',
      {
        symbol: '₹',
        code: 'INR',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    ],
  ]);

  private readonly multiLanguagePatterns: Map<string, EnhancedFieldPattern[]> =
    new Map([
      [
        'en',
        [
          {
            field: 'invoiceNumber',
            patterns: [
              'Invoice Number:',
              'Invoice #:',
              'Invoice:',
              'Ref:',
              'Reference:',
              'Document No.',
            ],
            regexPatterns: [
              'Invoice\\s*(?:Number|#)?\\s*:?\\s*([A-Z0-9\\-/\\(\\)\\[\\]\\s]+)',
              'Ref(?:erence)?\\s*#?\\s*:?\\s*([A-Z0-9\\-/\\(\\)\\[\\]\\s]+)',
              'Document\\s*(?:No\\.?|Number)\\s*:?\\s*([A-Z0-9\\-/\\(\\)\\[\\]\\s]+)',
              'lnvoice\\s*(?:Number|#)?\\s*:?\\s*([A-Z0-9\\-/\\(\\)\\[\\]\\s]+)', // OCR error: l instead of I
              'Inv\\s*:?\\s*([A-Z0-9\\-/\\(\\)\\[\\]\\s]+)', // Abbreviated
              '(?:^|\\s)([A-Z0-9]{2,}-[0-9]{4}-[A-Z0-9\\-]+)(?:\\s|$)', // Pattern like INV-2024-001
              '(?:^|\\s)([0-9]{4}-Q[0-9]-[0-9]{3}-[A-Z]+)(?:\\s|$)', // Pattern like 2024-Q1-001-REV
              '(?:^|\\s)([A-Z]{2,}/[0-9]{4}/[0-9]{2}/[0-9]{3})(?:\\s|$)', // Pattern like ABC/2024/03/001
              '\\[([A-Z0-9\\-/\\(\\)\\s]+)\\]', // Bracketed patterns
              '\\(([0-9]{4})\\)\\s*([0-9]{3}-[A-Z])', // Pattern like (2024) 001-A
            ],
            priority: 1,
            language: 'en',
          },
          {
            field: 'totalAmount',
            patterns: [
              'Total:',
              'Total Amount:',
              'Grand Total:',
              'Amount Due:',
              'Final Total:',
            ],
            regexPatterns: [
              'Total\\s*(?:Amount)?\\s*:?\\s*([\\$€£¥₹]?[\\d,\\.]+)',
              'Grand\\s*Total\\s*:?\\s*([\\$€£¥₹]?[\\d,\\.]+)',
              'Amount\\s*Due\\s*:?\\s*([\\$€£¥₹]?[\\d,\\.]+)',
              'Final\\s*Total\\s*:?\\s*([\\$€£¥₹]?[\\d,\\.]+)',
              'Tota1\\s*(?:Amount)?\\s*:?\\s*([\\$€£¥₹]?[\\d,\\.]+)', // OCR error: 1 instead of l
              'Amt\\s*:?\\s*([\\$€£¥₹]?[\\d,\\.]+)', // Abbreviated
              'Sum\\s*:?\\s*([\\d,\\.]+)\\s*([A-Z]{3})', // With currency code
              '([\\$€£¥₹])\\s*([\\d,\\.]+)', // Currency symbol first
              '([\\d,\\.]+)\\s*([\\$€£¥₹])', // Currency symbol after
              '([\\d,\\.]+)\\s+(USD|EUR|GBP|JPY|INR)', // Amount with currency code
            ],
            priority: 1,
            language: 'en',
          },
          {
            field: 'invoiceDate',
            patterns: [
              'Date:',
              'Invoice Date:',
              'Issued:',
              'Due:',
              'Due Date:',
            ],
            regexPatterns: [
              'Date\\s*:?\\s*([0-9]{4}-[0-9]{2}-[0-9]{2})', // YYYY-MM-DD
              'Date\\s*:?\\s*([0-9]{2}/[0-9]{2}/[0-9]{4})', // MM/DD/YYYY
              'Date\\s*:?\\s*([0-9]{2}-[0-9]{2}-[0-9]{4})', // MM-DD-YYYY
              'Date\\s*:?\\s*(\\w+\\s+[0-9]{1,2},?\\s+[0-9]{4})', // Month DD, YYYY
              'Date\\s*:?\\s*([0-9]{1,2}-\\w+-[0-9]{4})', // DD-Month-YYYY
              'Invoice\\s*Date\\s*:?\\s*([0-9]{2}-[0-9]{2}-[0-9]{4})', // Invoice Date: DD-MM-YYYY
              'Issued\\s*:?\\s*([0-9]{4}-[0-9]{2}-[0-9]{2})', // Issued: YYYY-MM-DD
              'Due\\s*(?:Date)?\\s*:?\\s*(\\w+\\s+[0-9]{1,2}(?:st|nd|rd|th)?,?\\s+[0-9]{4})', // Due Date: March 15th, 2024
              '0ate\\s*:?\\s*([0-9]{2}/[0-9]{2}/[0-9]{4})', // OCR error: 0 instead of D
            ],
            priority: 1,
            language: 'en',
          },
        ],
      ],
      [
        'es',
        [
          {
            field: 'invoiceNumber',
            patterns: [
              'Número de Factura:',
              'Factura:',
              'Ref:',
              'Referencia:',
              'Documento No.',
            ],
            regexPatterns: [
              'Número\\s*de\\s*Factura\\s*:?\\s*([A-Z0-9\\-/\\(\\)\\[\\]]+)',
              'Factura\\s*:?\\s*([A-Z0-9\\-/\\(\\)\\[\\]]+)',
              'Ref(?:erencia)?\\s*:?\\s*([A-Z0-9\\-/\\(\\)\\[\\]]+)',
            ],
            priority: 1,
            language: 'es',
          },
          {
            field: 'totalAmount',
            patterns: [
              'Total:',
              'Importe Total:',
              'Gran Total:',
              'Cantidad Debida:',
            ],
            regexPatterns: [
              'Total\\s*:?\\s*([€\\$£¥₹]?[\\d,\\.]+)',
              'Importe\\s*Total\\s*:?\\s*([€\\$£¥₹]?[\\d,\\.]+)',
              'Gran\\s*Total\\s*:?\\s*([€\\$£¥₹]?[\\d,\\.]+)',
            ],
            priority: 1,
            language: 'es',
          },
        ],
      ],
      [
        'de',
        [
          {
            field: 'invoiceNumber',
            patterns: [
              'Rechnungsnummer:',
              'Rechnung:',
              'Ref:',
              'Referenz:',
              'Dokument Nr.',
            ],
            regexPatterns: [
              'Rechnungsnummer\\s*:?\\s*([A-Z0-9\\-/\\(\\)\\[\\]]+)',
              'Rechnung\\s*:?\\s*([A-Z0-9\\-/\\(\\)\\[\\]]+)',
              'Ref(?:erenz)?\\s*:?\\s*([A-Z0-9\\-/\\(\\)\\[\\]]+)',
            ],
            priority: 1,
            language: 'de',
          },
          {
            field: 'totalAmount',
            patterns: ['Gesamt:', 'Gesamtbetrag:', 'Endsumme:', 'Zu zahlen:'],
            regexPatterns: [
              'Gesamt(?:betrag)?\\s*:?\\s*([€\\$£¥₹]?[\\d,\\.]+)',
              'Endsumme\\s*:?\\s*([€\\$£¥₹]?[\\d,\\.]+)',
              'Zu\\s*zahlen\\s*:?\\s*([€\\$£¥₹]?[\\d,\\.]+)',
            ],
            priority: 1,
            language: 'de',
          },
        ],
      ],
    ]);

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async extractFields(text: string, options: any): Promise<any> {
    try {
      logger.info('Enhanced field extraction started', {
        type: options.type,
        requiredFields: options.requiredFields,
      });

      // Use enhanced extraction
      const extractedData = await this.extractFieldsFromText(text, [], 1.0);

      // Validate required fields if specified
      if (options.requiredFields) {
        const missingFields = options.requiredFields.filter(
          (field: string) =>
            !extractedData[field] || extractedData[field] === null,
        );

        if (missingFields.length > 0) {
          logger.warn('Missing required fields', { missingFields });
          // Don't throw error, just log warning for now
        }
      }

      const result = {
        ...extractedData,
        rawText: text,
      };

      logger.info('Enhanced field extraction completed', {
        extractedFields: Object.keys(result).filter(
          (key) => key !== 'confidence' && key !== 'rawText',
        ),
        overallConfidence: this.calculateConfidence(result, [], 1.0),
      });

      return result;
    } catch (error) {
      logger.error('Enhanced field extraction failed', { error });
      throw error;
    }
  }

  protected async extractFieldsFromText(
    text: string,
    patterns: any[],
    ocrConfidence: number = 1.0,
  ): Promise<any> {
    const fields: any = {};
    const confidence: any = {};

    // Detect language
    const detectedLanguage = this.detectLanguage(text);
    logger.info(`Detected language: ${detectedLanguage}`);

    // Get enhanced patterns for detected language
    const enhancedPatterns = this.getEnhancedPatterns(detectedLanguage);

    // Extract fields using enhanced patterns
    for (const pattern of enhancedPatterns) {
      const extractionResult = await this.extractFieldWithEnhancedPattern(
        text,
        pattern,
      );
      if (extractionResult.value !== null) {
        fields[pattern.field] = extractionResult.value;
        confidence[pattern.field] = extractionResult.confidence;
      }
    }

    // Extract line items if present
    const lineItems = this.extractLineItems(text);
    if (lineItems.length > 0) {
      fields.lineItems = lineItems;
      confidence.lineItems = 0.9;
    }

    // Extract vendor and customer information with context
    const vendorInfo = this.extractVendorInfo(text);
    const customerInfo = this.extractCustomerInfo(text);

    Object.assign(fields, vendorInfo.fields);
    Object.assign(confidence, vendorInfo.confidence);
    Object.assign(fields, customerInfo.fields);
    Object.assign(confidence, customerInfo.confidence);

    return { ...fields, confidence };
  }

  private detectLanguage(text: string): string {
    const languageKeywords = {
      en: ['invoice', 'total', 'amount', 'date', 'due', 'bill', 'from', 'to'],
      es: ['factura', 'total', 'importe', 'fecha', 'vencimiento', 'de', 'para'],
      de: ['rechnung', 'gesamt', 'betrag', 'datum', 'fällig', 'von', 'an'],
    };

    const textLower = text.toLowerCase();
    let maxScore = 0;
    let detectedLang = 'en'; // Default to English

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

  private getEnhancedPatterns(language: string): EnhancedFieldPattern[] {
    return (
      this.multiLanguagePatterns.get(language) ||
      this.multiLanguagePatterns.get('en') ||
      []
    );
  }

  private async extractFieldWithEnhancedPattern(
    text: string,
    pattern: EnhancedFieldPattern,
  ): Promise<{ value: any; confidence: number }> {
    let bestMatch: { value: any; confidence: number } = {
      value: null,
      confidence: 0,
    };

    // Try regex patterns first (higher accuracy)
    if (pattern.regexPatterns) {
      for (const regexPattern of pattern.regexPatterns) {
        const match = this.extractWithRegex(text, regexPattern, pattern.field);
        if (match.confidence > bestMatch.confidence) {
          bestMatch = match;
        }
      }
    }

    // Try simple patterns with fuzzy matching
    if (bestMatch.confidence < 0.8) {
      for (const simplePattern of pattern.patterns) {
        const match = this.extractWithFuzzyMatch(
          text,
          simplePattern,
          pattern.field,
        );
        if (match.confidence > bestMatch.confidence) {
          bestMatch = match;
        }
      }
    }

    return bestMatch;
  }

  private extractWithRegex(
    text: string,
    regexPattern: string,
    field: string,
  ): { value: any; confidence: number } {
    try {
      const regex = new RegExp(regexPattern, 'gi');
      const matches = [...text.matchAll(regex)];

      if (matches && matches.length > 0) {
        for (const match of matches) {
          // Handle different capture group patterns
          let rawValue = '';
          let confidence = 0.9;

          if (match[1]) {
            rawValue = match[1].trim();
          } else if (match[2] && match[3]) {
            // Handle patterns like (2024) 001-A
            rawValue = `${match[2]} ${match[3]}`.trim();
          } else if (match[0]) {
            // Use the full match if no capture groups
            rawValue = match[0].trim();
            confidence = 0.7; // Lower confidence for full matches
          }

          if (rawValue) {
            const parsedValue = this.parseEnhancedFieldValue(
              rawValue,
              field,
              text,
            );
            if (parsedValue !== null && parsedValue !== undefined) {
              return { value: parsedValue, confidence };
            }
          }
        }
      }
    } catch (error) {
      logger.warn(
        `Regex extraction failed for pattern ${regexPattern}:`,
        error,
      );
    }

    return { value: null, confidence: 0 };
  }

  private extractWithFuzzyMatch(
    text: string,
    pattern: string,
    field: string,
  ): { value: any; confidence: number } {
    const lines = text.split('\n');

    for (const line of lines) {
      const similarity = this.calculateStringSimilarity(
        line.toLowerCase(),
        pattern.toLowerCase(),
      );

      if (similarity > 0.6) {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const rawValue = parts.slice(1).join(':').trim();
          const parsedValue = this.parseEnhancedFieldValue(
            rawValue,
            field,
            text,
          );
          const confidence = similarity * 0.8; // Reduce confidence for fuzzy matches

          return { value: parsedValue, confidence };
        }
      }
    }

    return { value: null, confidence: 0 };
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private parseEnhancedFieldValue(
    value: string,
    field: string,
    fullText: string,
  ): any {
    switch (field) {
      case 'totalAmount':
      case 'taxAmount':
      case 'subtotal':
        return this.parseAmount(value, fullText);
      case 'invoiceDate':
      case 'dueDate':
        return this.parseDate(value);
      case 'currency':
        return this.detectCurrency(value, fullText);
      default:
        return this.cleanTextValue(value);
    }
  }

  private parseAmount(value: string, fullText: string): number | null {
    if (!value) return null;

    // Detect currency and format
    const currencyInfo = this.detectCurrencyInfo(value, fullText);

    // Clean the value - remove everything except digits, commas, and periods
    let cleanValue = value.replace(/[^\d.,]/g, '');

    if (!cleanValue) return null;

    // Handle different decimal separators
    if (
      currencyInfo &&
      currencyInfo.decimalSeparator === ',' &&
      currencyInfo.thousandsSeparator === '.'
    ) {
      // European format: 1.234,56
      const parts = cleanValue.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Last comma is decimal separator
        cleanValue = parts[0].replace(/\./g, '') + '.' + parts[1];
      }
    } else {
      // US format: 1,234.56
      const parts = cleanValue.split('.');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Last period is decimal separator
        cleanValue = parts[0].replace(/,/g, '') + '.' + parts[1];
      } else {
        // No decimal part, just remove commas
        cleanValue = cleanValue.replace(/,/g, '');
      }
    }

    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? null : parsed;
  }

  private detectCurrencyInfo(
    value: string,
    fullText: string,
  ): CurrencyInfo | null {
    for (const [symbol, info] of this.currencyMap.entries()) {
      if (value.includes(symbol) || fullText.includes(symbol)) {
        return info;
      }
    }
    return null;
  }

  private detectCurrency(value: string, fullText: string): string {
    const currencyInfo = this.detectCurrencyInfo(value, fullText);
    return currencyInfo ? currencyInfo.code : 'USD';
  }

  private parseDate(value: string): Date | null {
    // Try multiple date formats
    const dateFormats = [
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
      /(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY or DD-MM-YYYY
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month DD, YYYY
      /(\d{1,2})-(\w+)-(\d{4})/, // DD-Month-YYYY
    ];

    for (const format of dateFormats) {
      const match = value.match(format);
      if (match) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return date;
          }
        } catch (error) {
          continue;
        }
      }
    }

    return null;
  }

  private cleanTextValue(value: string): string {
    // For invoice numbers and similar fields, preserve more characters
    return value.replace(/[^\w\s\-\.\(\)\[\]\/]/g, '').trim();
  }

  private extractLineItems(text: string): any[] {
    const lineItems: any[] = [];
    const lines = text.split('\n');

    // Look for line item patterns
    const itemPatterns = [
      /(\d+)\.\s*(.+?)\s+Qty:\s*(\d+)\s+Price:\s*([€$£¥₹]?[\d,\.]+)\s+Total:\s*([€$£¥₹]?[\d,\.]+)/gi,
      /(.+?)\s+-\s+Qty:\s*(\d+)\s+-\s+Price:\s*([€$£¥₹]?[\d,\.]+)\s+-\s+Total:\s*([€$£¥₹]?[\d,\.]+)/gi,
      /(.+?)\s+(\d+)\s+([€$£¥₹]?[\d,\.]+)\s+([€$£¥₹]?[\d,\.]+)/gi,
    ];

    for (const line of lines) {
      for (const pattern of itemPatterns) {
        const matches = [...line.matchAll(pattern)];
        for (const match of matches) {
          if (match.length >= 4) {
            const item = this.parseLineItem(match);
            if (item) {
              lineItems.push(item);
            }
          }
        }
      }
    }

    return lineItems;
  }

  private parseLineItem(match: RegExpMatchArray): any | null {
    try {
      // Different patterns have different group structures
      if (match.length === 6) {
        // Pattern 1: 1. Product A Qty: 2 Price: $500.00 Total: $1,000.00
        return {
          description: match[2].trim(),
          quantity: parseInt(match[3]),
          unitPrice: this.parseAmount(match[4], ''),
          amount: this.parseAmount(match[5], ''),
        };
      } else if (match.length === 5) {
        // Pattern 2: Product A - Qty: 2 - Price: $500.00 - Total: $1,000.00
        return {
          description: match[1].trim(),
          quantity: parseInt(match[2]),
          unitPrice: this.parseAmount(match[3], ''),
          amount: this.parseAmount(match[4], ''),
        };
      } else if (match.length === 5) {
        // Pattern 3: Product A 2 $500.00 $1,000.00
        return {
          description: match[1].trim(),
          quantity: parseInt(match[2]),
          unitPrice: this.parseAmount(match[3], ''),
          amount: this.parseAmount(match[4], ''),
        };
      }
    } catch (error) {
      logger.warn('Failed to parse line item:', error);
    }

    return null;
  }

  private extractVendorInfo(text: string): { fields: any; confidence: any } {
    const fields: any = {};
    const confidence: any = {};

    // Look for vendor section markers
    const vendorSectionRegex =
      /(?:FROM:|VENDOR:|BILL FROM:|SELLER:)([\s\S]*?)(?:TO:|CUSTOMER:|BILL TO:|BUYER:|INVOICE|$)/i;
    const vendorMatch = text.match(vendorSectionRegex);

    if (vendorMatch && vendorMatch[1]) {
      const vendorSection = vendorMatch[1].trim();

      // Extract vendor name (usually first line)
      const lines = vendorSection.split('\n').filter((line) => line.trim());
      if (lines.length > 0) {
        fields.vendorName = lines[0].trim();
        confidence.vendorName = 0.85;
      }

      // Extract vendor address
      if (lines.length > 1) {
        fields.vendorAddress = lines.slice(1).join('\n').trim();
        confidence.vendorAddress = 0.8;
      }

      // Extract tax ID
      const taxIdMatch = vendorSection.match(/Tax\s*ID\s*:?\s*([A-Z0-9\-]+)/i);
      if (taxIdMatch) {
        fields.vendorTaxId = taxIdMatch[1];
        confidence.vendorTaxId = 0.9;
      }
    }

    return { fields, confidence };
  }

  private extractCustomerInfo(text: string): { fields: any; confidence: any } {
    const fields: any = {};
    const confidence: any = {};

    // Look for customer section markers
    const customerSectionRegex =
      /(?:TO:|CUSTOMER:|BILL TO:|BUYER:)([\s\S]*?)(?:INVOICE|ITEMS?:|DESCRIPTION|$)/i;
    const customerMatch = text.match(customerSectionRegex);

    if (customerMatch && customerMatch[1]) {
      const customerSection = customerMatch[1].trim();

      // Extract customer name (usually first line)
      const lines = customerSection.split('\n').filter((line) => line.trim());
      if (lines.length > 0) {
        fields.customerName = lines[0].trim();
        confidence.customerName = 0.85;
      }

      // Extract customer address
      if (lines.length > 1) {
        fields.customerAddress = lines.slice(1).join('\n').trim();
        confidence.customerAddress = 0.8;
      }

      // Extract customer tax ID
      const taxIdMatch = customerSection.match(
        /Tax\s*ID\s*:?\s*([A-Z0-9\-]+)/i,
      );
      if (taxIdMatch) {
        fields.customerTaxId = taxIdMatch[1];
        confidence.customerTaxId = 0.9;
      }
    }

    return { fields, confidence };
  }

  // Override the confidence calculation to use enhanced scoring
  protected calculateConfidence(
    fields: any,
    patterns: any[],
    ocrConfidence: number,
  ): number {
    // Start with OCR confidence
    let confidence = ocrConfidence;

    // Calculate field-specific confidence scores
    const fieldConfidences = Object.values(fields.confidence || {}) as number[];
    if (fieldConfidences.length > 0) {
      const avgFieldConfidence =
        fieldConfidences.reduce((sum, conf) => sum + conf, 0) /
        fieldConfidences.length;

      // Weight OCR confidence (30%) and field extraction confidence (70%)
      confidence = ocrConfidence * 0.3 + avgFieldConfidence * 0.7;
    }

    // Boost confidence for complete extractions
    const extractedFieldCount = Object.keys(fields).filter(
      (key) => key !== 'confidence',
    ).length;
    const expectedFieldCount = patterns.length || 8; // Default expected fields
    const completenessBonus =
      Math.min(extractedFieldCount / expectedFieldCount, 1) * 0.1;

    confidence = Math.min(confidence + completenessBonus, 1.0);

    // Penalize for very low individual field confidences
    const lowConfidenceFields = fieldConfidences.filter(
      (conf) => conf < 0.5,
    ).length;
    if (lowConfidenceFields > 0) {
      const penalty = (lowConfidenceFields / fieldConfidences.length) * 0.2;
      confidence = Math.max(confidence - penalty, 0.1);
    }

    return Math.min(Math.max(confidence, 0), 1);
  }
}
