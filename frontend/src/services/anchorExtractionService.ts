/**
 * Anchor-based Extraction Service
 * Uses keyword anchors and text layout (x,y positions) to extract fields
 * Works offline and complements OCR by leveraging PDF text layer when available
 */

import { InvoiceType } from './invoiceTypeDetector';
import VendorTemplateService from './vendorTemplateService';

export interface PositionedWord {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  page?: number;
}

export interface TextLine {
  y: number;
  page: number;
  words: PositionedWord[];
  text: string;
}

export interface LayoutText {
  lines: TextLine[];
}

export interface AnchorExtractionResult {
  fields: Partial<{
    invoiceNumber: string;
    vendorName: string;
    invoiceDate: string;
    dueDate: string;
    subtotal: number | string;
    taxAmount: number | string;
    totalAmount: number | string;
  }>;
  fieldConfidence: Record<string, number>; // 0..1
  debug?: any;
}

const AMOUNT_REGEX = /([€$£]?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|[€$£]?\s?\d+(?:[.,]\d{2})?)/;
const DATE_REGEXES = [
  /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/, // YYYY-MM-DD
  /(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/, // DD/MM/YYYY or MM/DD/YYYY
];

const FIELD_ANCHORS: Record<InvoiceType | 'any', Record<string, string[]>> = {
  any: {
    invoiceNumber: ['invoice number', 'invoice no', 'invoice #', 'inv #', 'inv.', 'inv no', 'inv number'],
    invoiceDate: ['invoice date', 'date of invoice', 'date issued', 'date'],
    dueDate: ['due date', 'payment due', 'pay by'],
    subtotal: ['subtotal', 'sub-total'],
    taxAmount: ['tax', 'vat', 'gst', 'sales tax'],
    totalAmount: ['total', 'amount due', 'grand total', 'balance due'],
    vendorName: ['vendor', 'from', 'seller', 'supplier'],
  },
  standard: {},
  purchase_order: {
    invoiceNumber: ['po number', 'purchase order', 'po #', 'po no'],
    invoiceDate: ['order date'],
    totalAmount: ['total amount', 'total'],
  },
  receipt: {
    invoiceNumber: ['receipt #', 'receipt no', 'txn id'],
  },
  credit_note: {
    invoiceNumber: ['credit note', 'credit memo', 'cn #'],
  },
  debit_note: {
    invoiceNumber: ['debit note', 'debit memo', 'dn #'],
  },
  unknown: {},
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s:#.%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  const as = new Set(normalize(a).split(' '));
  const bs = new Set(normalize(b).split(' '));
  const inter = [...as].filter(t => bs.has(t));
  const denom = Math.max(as.size, bs.size) || 1;
  return inter.length / denom;
}

function isAnchorMatch(text: string, anchor: string): boolean {
  const nText = normalize(text);
  const nAnc = normalize(anchor);
  if (nAnc === 'total' && /(\bsub\s*-?\s*total\b)/.test(nText)) return false;
  if (nText.includes(nAnc)) return true;
  return tokenSimilarity(nText, nAnc) >= 0.7;
}

function findAnchorInLine(line: TextLine, anchors: string[]): { idx: number; match: string } | null {
  for (let i = 0; i < line.words.length; i++) {
    const probe = line.words.slice(0, i + 1).map(w => w.text).join(' ');
    if (anchors.some(a => isAnchorMatch(probe, a))) {
      return { idx: i, match: probe };
    }
  }
  // fallback: whole line
  if (anchors.some(a => isAnchorMatch(line.text, a))) {
    return { idx: Math.max(0, Math.floor(line.words.length / 2)), match: line.text };
  }
  return null;
}

function pickRightValue(line: TextLine, field?: string): string | null {
  // choose the first plausible value to the right based on field type
  const textRight = line.text.split(/:\s*/i).slice(1).join(': ').trim();
  if (textRight) {
    if (field === 'invoiceDate' || field === 'dueDate') {
      for (const rx of DATE_REGEXES) {
        const m = textRight.match(rx);
        if (m) return m[0];
      }
    }
    if (field === 'subtotal' || field === 'taxAmount' || field === 'totalAmount') {
      const amt = textRight.match(AMOUNT_REGEX);
      if (amt) return amt[0];
    }
    if (field === 'invoiceNumber') {
      const tok = textRight.split(/\s+/).find(t => /[A-Za-z-].*/.test(t) || /[A-Za-z0-9-]{2,}/.test(t));
      if (tok) return tok;
    }
    // generic fallbacks
    const amt = textRight.match(AMOUNT_REGEX);
    if (amt) return amt[0];
    for (const rx of DATE_REGEXES) {
      const m = textRight.match(rx);
      if (m) return m[0];
    }
    const tok = textRight.split(/\s+/).find(t => /[A-Za-z0-9-]/.test(t));
    if (tok) return tok;
  }
  // fallback: scan words on the right half by x
  const midX = line.words.length ? (line.words.reduce((s, w) => s + w.x, 0) / line.words.length) : 0;
  const rightWords = line.words.filter(w => w.x >= midX).map(w => w.text);
  const joined = rightWords.join(' ');
  if (field === 'subtotal' || field === 'taxAmount' || field === 'totalAmount') {
    const amt2 = joined.match(AMOUNT_REGEX);
    if (amt2) return amt2[0];
  }
  return rightWords[0] || null;
}

function firstNonBoilerplate(lines: TextLine[]): string | null {
  for (const line of lines.slice(0, 6)) {
    const t = normalize(line.text);
    if (!t) continue;
    if (/(invoice|bill to|ship to|sold to|tax|total|receipt|credit|debit)/.test(t)) continue;
    if (t.length < 3) continue;
    return line.text.trim();
  }
  return null;
}

function mergeAnchorMaps(base: Record<string, string[]>, overrides?: Record<string, string[]>) {
  if (!overrides) return base;
  const out: Record<string, string[]> = { ...base };
  for (const k of Object.keys(overrides)) {
    const set = new Set([...(out[k] || []), ...overrides[k]]);
    out[k] = Array.from(set);
  }
  return out;
}

export class AnchorExtractionService {
  static extractFields(
    rawText: string,
    layout: LayoutText | undefined,
    invoiceType: InvoiceType,
    vendorName?: string
  ): AnchorExtractionResult {
    const result: AnchorExtractionResult = { fields: {}, fieldConfidence: {}, debug: {} };

    let anchors = {
      ...FIELD_ANCHORS.any,
      ...FIELD_ANCHORS[invoiceType],
    } as Record<string, string[]>;

    if (vendorName) {
      const vtpl = VendorTemplateService.getAnchorsForVendor(vendorName);
      anchors = mergeAnchorMaps(anchors, vtpl);
    }

    const lines = layout?.lines || [];

    const tryAnchored = (field: keyof AnchorExtractionResult['fields']): string | null => {
      const patterns = anchors[field as string];
      if (!patterns || lines.length === 0) return null;
      for (const line of lines) {
        const found = findAnchorInLine(line, patterns);
        if (found) {
          const value = pickRightValue(line, field as string);
          if (value) {
            // confidence: strong if exact include, else token-similarity
            const strong = patterns.some(a => normalize(line.text).includes(normalize(a)));
            result.fieldConfidence[field as string] = strong ? 0.95 : 0.85;
            return value;
          }
        }
      }
      return null;
    };

    // Anchored extraction for numeric/date fields
    const anchoredInvoiceNumber = tryAnchored('invoiceNumber');
    const anchoredInvoiceDate = tryAnchored('invoiceDate');
    const anchoredDueDate = tryAnchored('dueDate');
    const anchoredSubtotal = tryAnchored('subtotal');
    const anchoredTax = tryAnchored('taxAmount');
    const anchoredTotal = tryAnchored('totalAmount');

    if (anchoredInvoiceNumber) result.fields.invoiceNumber = anchoredInvoiceNumber;
    if (anchoredInvoiceDate) result.fields.invoiceDate = anchoredInvoiceDate;
    if (anchoredDueDate) result.fields.dueDate = anchoredDueDate;
    if (anchoredSubtotal) result.fields.subtotal = anchoredSubtotal;
    if (anchoredTax) result.fields.taxAmount = anchoredTax;
    if (anchoredTotal) result.fields.totalAmount = anchoredTotal;

    // Vendor name: prefer top non-boilerplate line
    if (!result.fields.vendorName) {
      const vendor = firstNonBoilerplate(lines);
      if (vendor) {
        result.fields.vendorName = vendor;
        result.fieldConfidence.vendorName = 0.6;
      }
    }

    // Fallbacks with regex on raw text for amounts and dates if still missing
    const rt = rawText || '';
    if (!result.fields.totalAmount) {
      const m = rt.match(/(?:total|amount due|grand total)\s*[:]?\s*([€$£]?\s?\d[\d.,]*)/i);
      if (m) {
        result.fields.totalAmount = m[1];
        result.fieldConfidence.totalAmount = Math.max(result.fieldConfidence.totalAmount || 0, 0.7);
      }
    }
    if (!result.fields.invoiceDate) {
      for (const rx of DATE_REGEXES) {
        const m = rt.match(new RegExp(`(?:invoice date|date issued|date)\s*[:]?\s*${rx.source}`, 'i'));
        if (m) {
          result.fields.invoiceDate = m[0].replace(/^(?:invoice date|date issued|date)\s*[:]?\s*/i, '');
          result.fieldConfidence.invoiceDate = Math.max(result.fieldConfidence.invoiceDate || 0, 0.65);
          break;
        }
      }
    }

    return result;
  }
}

export default AnchorExtractionService;

