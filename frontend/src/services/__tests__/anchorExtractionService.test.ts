import { describe, it, expect } from 'vitest';
import AnchorExtractionService, { LayoutText, TextLine } from '../anchorExtractionService';
import { InvoiceType } from '../invoiceTypeDetector';

function makeLines(texts: string[], yStart = 800, dy = 20, page = 1): TextLine[] {
  return texts.map((t, idx) => ({ y: yStart - idx * dy, page, text: t, words: t.split(/\s+/).map((w, j) => ({ text: w, x: 50 + j * 20, y: yStart - idx * dy })) })) as any;
}

describe('AnchorExtractionService', () => {
  it('extracts fields using anchors and positions (standard labels)', () => {
    const lines = makeLines([
      'ACME CORPORATION',
      'Invoice Number: INV-12345',
      'Invoice Date: 2024-03-01',
      'Due Date: 2024-03-10',
      'Subtotal: $100.00',
      'Tax: $20.00',
      'Total: $120.00',
    ]);
    const layout: LayoutText = { lines };
    const rawText = lines.map(l => l.text).join('\n');

    const res = AnchorExtractionService.extractFields(rawText, layout, 'standard' as InvoiceType);

    expect(res.fields.invoiceNumber).toContain('INV-');
    expect(res.fields.invoiceDate).toContain('2024');
    expect(res.fields.dueDate).toContain('2024');
    expect(String(res.fields.totalAmount)).toMatch(/120/);
    expect(res.fieldConfidence.invoiceNumber).toBeGreaterThan(0.8);
    expect(res.fieldConfidence.totalAmount).toBeGreaterThan(0.8);
  });

  it('supports fuzzy anchor variants', () => {
    const lines = makeLines([
      'ACME CORP',
      'Inv. #: X-77',
      'Amount Due: $55.90',
    ]);
    const layout: LayoutText = { lines };
    const rawText = lines.map(l => l.text).join('\n');

    const res = AnchorExtractionService.extractFields(rawText, layout, 'standard' as InvoiceType);

    expect((res.fields.invoiceNumber || '')).toContain('X-');
    // amount may be captured via fallback (right-of anchor or regex)
    expect(String(res.fields.totalAmount || '')).toMatch(/55\.90/);
  });
});

