/**
 * Validation Service with Quality Gates
 * - Amount math check (subtotal + tax ≈ total)
 * - Date parsing and ordering
 * - Invoice number sanity checks
 * - Currency/number normalization for EU/US formats
 * - Duplicate detection (within batch + existing)
 * Produces per-field confidences and overall quality score
 */

import { Invoice } from './invoiceStorage';

export interface ValidationOptions {
  amountTolerance?: number; // absolute tolerance, default 0.01
  minConfidenceThreshold?: number; // 0..1, default 0.7
  existingInvoices?: Invoice[];
  batchInvoices?: Invoice[];
}

export interface ValidationResult {
  valid: boolean;
  requiredFieldsPassed: boolean;
  errors: string[];
  fieldConfidence: Record<string, number>; // 0..1
  qualityScore: number; // 0..1
}

function normalizeNumberString(input: string): string {
  // Remove currency symbols and spaces
  let s = input.replace(/[\s\u00A0\$\u20ac\u00a3]/g, '');
  // Handle negative in parentheses
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: the one that appears last is decimal
    const decIsComma = lastComma > lastDot;
    s = s.replace(/[.,]/g, (m) => (m === (decIsComma ? ',' : '.') ? '.' : ''));
    return s;
  }
  if (lastComma !== -1) {
    // Only comma present
    const decPart = s.split(',')[1] || '';
    if (decPart.length === 2) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
    return s;
  }
  // Only dot present or none
  s = s.replace(/,/g, '');
  return s;
}

export function parseAmount(input: string | number | undefined | null): number | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input === 'number') return input;
  const s = normalizeNumberString(input);
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function parseDateFlexible(input?: string): Date | undefined {
  if (!input) return undefined;
  const s = input.trim();
  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (m) {
    const [_, y, mo, d] = m;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    return isNaN(dt.getTime()) ? undefined : dt;
  }
  // DD/MM/YYYY or MM/DD/YYYY (ambiguous)
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3].length === 2 ? '20' + m[3] : m[3]);
    const firstLikelyDay = a > 12; // 13-31 suggests D/M/Y
    const day = firstLikelyDay ? a : b;
    const month = firstLikelyDay ? b : a;
    const dt = new Date(y, month - 1, day);
    return isNaN(dt.getTime()) ? undefined : dt;
  }
  return undefined;
}

function isDateOrderValid(inv?: string, due?: string): boolean {
  const a = parseDateFlexible(inv);
  const b = parseDateFlexible(due);
  if (!a || !b) return true; // don't punish missing
  return a.getTime() <= b.getTime();
}

function isLikelyDateString(s: string): boolean {
  return /^(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4})$/.test(s.trim());
}

function isReasonableInvoiceNumber(s?: string): boolean {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 2) return false;
  if (isLikelyDateString(t)) return false;
  // Allow alnum and dashes/underscores, but avoid single token of < 2 or obvious junk
  return /[A-Za-z0-9]/.test(t);
}

function makeDedupKey(inv: Partial<Invoice>): string {
  const num = (inv.invoiceNumber || '').toString().toLowerCase().trim();
  const ven = (inv.vendorName || '').toString().toLowerCase().trim();
  const dat = (inv.invoiceDate || '').toString().slice(0, 10);
  const tot = String(inv.totalAmount ?? '');
  return `${ven}|${num}|${dat}|${tot}`;
}

export class ValidationService {
  static validateInvoice(inv: Partial<Invoice>, opts: ValidationOptions = {}): ValidationResult {
    const errors: string[] = [];
    const fieldConfidence: Record<string, number> = { ...(inv as any).fieldConfidence };

    const tol = opts.amountTolerance ?? 0.01;
    const minC = opts.minConfidenceThreshold ?? 0.7;

    const subtotal = parseAmount(inv.subtotal as any);
    const tax = parseAmount(inv.taxAmount as any);
    const total = parseAmount(inv.totalAmount as any);

    // Amount math check
    if (subtotal !== undefined && total !== undefined) {
      const expected = (subtotal ?? 0) + (tax ?? 0);
      const diff = Math.abs(expected - (total ?? 0));
      if (diff > tol) {
        errors.push(`Amount check failed: subtotal(${subtotal?.toFixed(2)}) + tax(${(tax ?? 0).toFixed(2)}) != total(${(total ?? 0).toFixed(2)})`);
      } else {
        fieldConfidence.totalAmount = Math.max(fieldConfidence.totalAmount ?? 0, 0.9);
      }
    }

    // Date ordering
    if (!isDateOrderValid(inv.invoiceDate as any, inv.dueDate as any)) {
      errors.push('Date order invalid: invoiceDate should be <= dueDate');
    } else if (inv.invoiceDate && inv.dueDate) {
      fieldConfidence.invoiceDate = Math.max(fieldConfidence.invoiceDate ?? 0, 0.8);
      fieldConfidence.dueDate = Math.max(fieldConfidence.dueDate ?? 0, 0.8);
    }

    // Invoice number sanity
    if (!isReasonableInvoiceNumber(inv.invoiceNumber)) {
      errors.push('Invoice number looks invalid');
    } else {
      fieldConfidence.invoiceNumber = Math.max(fieldConfidence.invoiceNumber ?? 0, 0.75);
    }

    // Currency normalization sanity
    if (total === undefined) errors.push('Total amount missing or invalid');
    if (!inv.vendorName || String(inv.vendorName).trim().length < 2) errors.push('Vendor name missing or too short');

    // Duplicate detection
    const key = makeDedupKey(inv);
    const seen = new Set<string>();
    (opts.batchInvoices || []).forEach(i => seen.add(makeDedupKey(i)));
    if (seen.has(key)) {
      errors.push('Duplicate within batch');
    }
    if (opts.existingInvoices && opts.existingInvoices.length) {
      const eSeen = new Set(opts.existingInvoices.map(i => makeDedupKey(i)));
      if (eSeen.has(key)) errors.push('Duplicate with existing storage');
    }

    // Required fields gate
    const requiredPassed = Boolean(inv.invoiceNumber && inv.vendorName && total !== undefined);

    // Quality score (weighted)
    const weights: Record<string, number> = {
      totalAmount: 3,
      invoiceNumber: 2,
      vendorName: 2,
      invoiceDate: 1,
      dueDate: 1,
      subtotal: 1,
      taxAmount: 1,
    };
    let score = 0;
    let maxScore = 0;
    for (const [k, w] of Object.entries(weights)) {
      score += (fieldConfidence[k] ?? 0) * w;
      maxScore += w;
    }
    const qualityScore = maxScore ? score / maxScore : 0;

    // Apply min confidence threshold to decide validity
    const valid = requiredPassed && qualityScore >= minC && errors.length === 0;

    return { valid, requiredFieldsPassed: requiredPassed, errors, fieldConfidence, qualityScore };
  }
}

export default ValidationService;

