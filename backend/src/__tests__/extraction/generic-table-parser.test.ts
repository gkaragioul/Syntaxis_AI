
import { GenericTableParser } from '../../services/extraction/GenericTableParser';
import { TableDetector } from '../../services/ai-ml/TableDetector';

describe('GenericTableParser', () => {
    let parser: GenericTableParser;

    beforeEach(() => {
        // We can pass null as we're testing the processOCRData method which essentially uses TableDetector
        parser = new GenericTableParser(null as any); 
    });

    it('should detect a simple 3-column table from mock bounding boxes', () => {
        // Mock data simulating a table:
        // Item       Quantity    Price
        // Widget A   2           $10.00
        // Widget B   1           $5.00
        
        const mockBoundingBoxes = [
            // Header Row (Y ~ 100)
            { text: 'Item', boundingBox: { vertices: [{x: 10, y: 100}, {x: 50, y: 100}, {x: 50, y: 120}, {x: 10, y: 120}] } },
            { text: 'Quantity', boundingBox: { vertices: [{x: 100, y: 100}, {x: 150, y: 100}, {x: 150, y: 120}, {x: 100, y: 120}] } },
            { text: 'Price', boundingBox: { vertices: [{x: 200, y: 100}, {x: 250, y: 100}, {x: 250, y: 120}, {x: 200, y: 120}] } },
            
            // Row 1 (Y ~ 140)
            { text: 'Widget', boundingBox: { vertices: [{x: 10, y: 140}, {x: 40, y: 140}, {x: 40, y: 160}, {x: 10, y: 160}] } },
            { text: 'A', boundingBox: { vertices: [{x: 45, y: 140}, {x: 55, y: 140}, {x: 55, y: 160}, {x: 45, y: 160}] } },
            // "Widget A" might be two blocks. Detector should ideally handle spacing or we simulate tight spacing.
            { text: '2', boundingBox: { vertices: [{x: 110, y: 140}, {x: 120, y: 140}, {x: 120, y: 160}, {x: 110, y: 160}] } },
            { text: '$10.00', boundingBox: { vertices: [{x: 200, y: 140}, {x: 240, y: 140}, {x: 240, y: 160}, {x: 200, y: 160}] } },
            
            // Row 2 (Y ~ 180)
            { text: 'Widget', boundingBox: { vertices: [{x: 10, y: 180}, {x: 40, y: 180}, {x: 40, y: 200}, {x: 10, y: 200}] } },
            { text: 'B', boundingBox: { vertices: [{x: 45, y: 180}, {x: 55, y: 180}, {x: 55, y: 200}, {x: 45, y: 200}] } },
            { text: '1', boundingBox: { vertices: [{x: 110, y: 180}, {x: 120, y: 180}, {x: 120, y: 200}, {x: 110, y: 200}] } },
            { text: '$5.00', boundingBox: { vertices: [{x: 200, y: 180}, {x: 240, y: 180}, {x: 240, y: 200}, {x: 200, y: 200}] } },
        ];

        const tables = parser.processOCRData(mockBoundingBoxes);

        expect(tables.length).toBeGreaterThan(0);
        const table = tables[0];
        
        // Verify Headers
        expect(table.headers).toContain('Item');
        expect(table.headers).toContain('Quantity');
        expect(table.headers).toContain('Price');
        
        // Verify Rows
        expect(table.rows.length).toBe(2);
        
        // Check content loosely
        const row1 = table.rows[0].join(' ');
        expect(row1).toContain('Widget A');
        expect(row1).toContain('2');
        expect(row1).toContain('$10.00');
    });
});
