import { FingerprintService } from '../../services/analysis/FingerprintService';
import { FingerprintV1 } from '../../types/fingerprint.types';

describe('FingerprintService', () => {
    let service: FingerprintService;

    beforeEach(() => {
        service = new FingerprintService();
    });

    const createTextItem = (str: string, x: number, y: number) => ({
        page: 1,
        str,
        x,
        y,
        width: 0.1,
        height: 0.02
    });

    describe('calculateFingerprintFromItems', () => {
        it('should detect scanned document (low text density)', () => {
             const items = [
                 createTextItem('Page', 0.5, 0.5),
                 createTextItem('1', 0.5, 0.6)
             ];
             const fingerprint = service.calculateFingerprintFromItems(items, 2); // 2 pages, very few chars
             expect(fingerprint.is_scanned).toBe(true);
        });

        it('should extract top keywords', () => {
             const items = [
                 createTextItem('Invoice Invoice Invoice', 0.1, 0.1),
                 createTextItem('Total Total', 0.1, 0.2),
                 createTextItem('Vendor', 0.1, 0.3)
             ];
             const fingerprint = service.calculateFingerprintFromItems(items, 1);
             expect(fingerprint.top_keywords).toContain('invoice');
             expect(fingerprint.top_keywords).toContain('total');
             // 'vendor' might be there too
             expect(fingerprint.top_keywords[0]).toBe('invoice'); // Most frequent
        });

        it('should compute consistent header hash', () => {
            const items = [
                createTextItem('Acme Corp Header', 0.1, 0.05), // y < 0.1
                createTextItem('Body content', 0.1, 0.5)
            ];
            const f1 = service.calculateFingerprintFromItems(items, 1);
            const f2 = service.calculateFingerprintFromItems(items, 1);
            
            expect(f1.header_footer_signature.header_text_hash).toBe(f2.header_footer_signature.header_text_hash);
            expect(f1.header_footer_signature.header_text_hash).not.toBe('');
        });

        it('should detect columns', () => {
             // Create a table-like structure with 2 columns
             const items = [];
             for(let i=0; i<10; i++) {
                 // Column 1 at x=0.2
                 items.push(createTextItem('Col1Row' + i, 0.2, 0.2 + i*0.05));
                 // Column 2 at x=0.8
                 items.push(createTextItem('Col2Row' + i, 0.8, 0.2 + i*0.05));
             }
             
             const fingerprint = service.calculateFingerprintFromItems(items, 1);
             const cols = fingerprint.column_x_signature[0].xs_norm;
             
             expect(cols.length).toBeGreaterThanOrEqual(2);
             // Should find peaks around 0.2 and 0.8.
             // Note: Implementation rounds to nearest 0.05.
             expect(cols.some(x => Math.abs(x - 0.2) < 0.01)).toBe(true);
             expect(cols.some(x => Math.abs(x - 0.8) < 0.01)).toBe(true);
        });
    });
});
