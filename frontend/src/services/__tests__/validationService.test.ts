import { describe, it, expect } from 'vitest';
import ValidationService, { parseAmount, parseDateFlexible } from '../validationService';
import type { Invoice } from '../invoiceStorage';

describe('ValidationService parsing', () => {
  it('parses US and EU currency formats', () => {
    expect(parseAmount('1,234.56')).toBeCloseTo(1234.56, 2);
    expect(parseAmount('1.234,56')).toBeCloseTo(1234.56, 2);
    expect(parseAmount('$ 120.00')).toBeCloseTo(120, 2);
  });

  it('parses multiple date formats', () => {
    const a = parseDateFlexible('2024-03-01');
    const b = parseDateFlexible('01/03/2024'); // ambiguous; treated as 1/3 or 3/1 depending; just ensure valid
    const c = parseDateFlexible('10.04.2024');
    expect(a?.getFullYear()).toBe(2024);
    expect(b).toBeInstanceOf(Date);
    expect(c).toBeInstanceOf(Date);
  });
});

describe('ValidationService rules', () => {
  it('validates amount math and date order; computes quality', () => {
    const inv: Partial<Invoice> = {
      invoiceNumber: 'INV-1001',
      vendorName: 'Acme',
      invoiceDate: '2024-03-01',
      dueDate: '2024-03-10',
      subtotal: 100,
      taxAmount: 20,
      totalAmount: 120,
      fieldConfidence: { invoiceNumber: 0.8, vendorName: 0.7 },
    } as any;

    const res = ValidationService.validateInvoice(inv, { minConfidenceThreshold: 0.5 });
    expect(res.errors.length).toBe(0);
    expect(res.valid).toBe(true);
    expect(res.qualityScore).toBeGreaterThan(0.5);
  });

  it('flags invalid totals', () => {
    const inv: Partial<Invoice> = {
      invoiceNumber: 'INV-2002',
      vendorName: 'Globex',
      subtotal: 100,
      taxAmount: 20,
      totalAmount: 121,
    } as any;
    const res = ValidationService.validateInvoice(inv, { minConfidenceThreshold: 0.3 });
    expect(res.errors.some(e => /Amount check failed/.test(e))).toBe(true);
    expect(res.valid).toBe(false);
  });

  it('rejects date order violation', () => {
    const inv: Partial<Invoice> = {
      invoiceNumber: 'X-1',
      vendorName: 'Vendor',
      invoiceDate: '2024-05-10',
      dueDate: '2024-05-01',
      totalAmount: 10,
    } as any;
    const res = ValidationService.validateInvoice(inv, { minConfidenceThreshold: 0.3 });
    expect(res.errors.some(e => /Date order invalid/.test(e))).toBe(true);
  });

  it('rejects obvious junk invoice number (date-like)', () => {
    const inv: Partial<Invoice> = {
      invoiceNumber: '2024-12-31',
      vendorName: 'Vendor',
      totalAmount: 10,
    } as any;
    const res = ValidationService.validateInvoice(inv, { minConfidenceThreshold: 0.3 });
    expect(res.errors.some(e => /Invoice number looks invalid/.test(e))).toBe(true);
  });

  it('detects duplicates against existing', () => {
    const inv: Partial<Invoice> = {
      invoiceNumber: 'A-1',
      vendorName: 'V',
      invoiceDate: '2024-01-01',
      totalAmount: 10,
    } as any;
    const existing: Partial<Invoice>[] = [
      { invoiceNumber: 'A-1', vendorName: 'V', invoiceDate: '2024-01-01', totalAmount: 10 },
    ];
    const res = ValidationService.validateInvoice(inv, { minConfidenceThreshold: 0.1, existingInvoices: existing as any });
    expect(res.errors.some(e => /Duplicate/.test(e))).toBe(true);
  });
});

