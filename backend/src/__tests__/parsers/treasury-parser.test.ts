
import { TreasuryConsolidationParser } from '../../services/parsers/TreasuryConsolidationParser';
import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';

// No sample document ships with the repository. To run this integration test,
// point TREASURY_SAMPLE_PDF at your own treasury consolidation report PDF, or
// place one at samples/treasury-sample.pdf (the samples/ folder is git-ignored).
// Without a PDF the assertions are skipped.
const TEST_PDF_PATH =
    process.env.TREASURY_SAMPLE_PDF ||
    path.resolve(__dirname, '../../../../samples/treasury-sample.pdf');

describe('TreasuryConsolidationParser', () => {
    let pdfText: string;

    beforeAll(async () => {
        if (fs.existsSync(TEST_PDF_PATH)) {
            const dataBuffer = fs.readFileSync(TEST_PDF_PATH);
            const data = await pdf(dataBuffer);
            pdfText = data.text;
        } else {
            console.warn('Test PDF not found, skipping integration test');
        }
    });

    it('should identify the Treasury Consolidation template', () => {
        if (!pdfText) return;
        const result = TreasuryConsolidationParser.matches(pdfText);
        expect(result).toBe(true);
    });

    it('should extract headers correctly', () => {
        if (!pdfText) return;
        const result = TreasuryConsolidationParser.parse(pdfText);
        
        expect(result.headers.length).toBeGreaterThan(0);
        expect(result.headers[0]).toContain('Head of Account');
        expect(result.headers).toContain('D.A.T Pondy');
    });

    it('should extract rows correctly', () => {
        if (!pdfText) return;
        const result = TreasuryConsolidationParser.parse(pdfText);
        
        expect(result.rows.length).toBeGreaterThan(0);
        // Verify a known row content from previous analysis
        // "23 2011 02 101 01 01"
        const knownRow = result.rows.find(row => row.some(col => col.includes('23 2011 02 101 01 01')));
        expect(knownRow).toBeDefined();
    });
});
