import * as pdfjs from 'pdfjs-dist';
import { FingerprintV1, BlockSignature, ColumnXSignature, HeaderFooterSignature } from '../../types/fingerprint.types';
import crypto from 'crypto';

// Ensure worker is set up (though in node environment it might use a fake worker or need explicit path)
// For this environment, we assume pdfjs-dist is configured or we use the 'legacy' build if needed.
// Often in Node, we don't need to set the workerSrc if using the main entry point correctly, 
// but sometimes we do. Let's try standard import first.

export class FingerprintService {
  /**
   * Generates a structural fingerprint for a PDF document.
   */
  /**
   * Generates a structural fingerprint for a PDF document.
   */
  async generate(buffer: Buffer): Promise<FingerprintV1> {
    const data = new Uint8Array(buffer);
    const doc = await pdfjs.getDocument({ data }).promise;
    const pageCount = doc.numPages;

    const allTextItems: { page: number; str: string; x: number; y: number; width: number; height: number }[] = [];
    
    // Analyze first 2 pages for keywords and signatures
    const limitPages = Math.min(pageCount, 2);
    
    for (let i = 1; i <= limitPages; i++) {
        const page = await doc.getPage(i);
        const { width, height } = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        
        for (const item of textContent.items) {
             if ('str' in item) {
                 const tx = item.transform; // [scaleX, skewY, skewX, scaleY, translateX, translateY]
                 
                 const x = tx[4];
                 const y = height - tx[5]; // Flip Y
                 const w = item.width;
                 const h = Math.abs(tx[3]); // Height approximation
                 
                 allTextItems.push({ 
                     page: i, 
                     str: item.str, 
                     x: x / width, // Normalize immediately
                     y: y / height, 
                     width: w / width, 
                     height: h / height 
                 });
             }
        }
    }

    return this.calculateFingerprintFromItems(allTextItems, pageCount);
  }

  /**
   * Public for testing. Calculates fingerprint from extracted text items.
   */
  public calculateFingerprintFromItems(
      allTextItems: { page: number; str: string; x: number; y: number; width: number; height: number }[],
      pageCount: number
  ): FingerprintV1 {
    const keywordsMap = new Map<string, number>();
    const limitPages = Math.min(pageCount, 2);

    allTextItems.forEach(item => {
         // Keyword extraction
         const words = item.str.toLowerCase().match(/\b[a-z]{3,}\b/g);
         if (words) {
             words.forEach(w => {
                 if (!this.isStopword(w)) {
                     keywordsMap.set(w, (keywordsMap.get(w) || 0) + 1);
                 }
             });
         }
    });

    // Is Scanned Detection
    const totalChars = allTextItems.reduce((acc, item) => acc + item.str.length, 0);
    const is_scanned = totalChars < 50 * limitPages;

    // Top Keywords
    const top_keywords = Array.from(keywordsMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(e => e[0]);

    // Blocks Signature (Clustering)
    const blocks_signature = this.computeBlockSignature(allTextItems);

    // Column X Signature
    const column_x_signature = this.computeColumnSignature(allTextItems);

    // Header/Footer Hash
    const header_footer_signature = this.computeHeaderFooterHash(allTextItems);

    return {
      version: '1.0',
      is_scanned,
      page_count: pageCount,
      top_keywords,
      blocks_signature,
      column_x_signature,
      header_footer_signature,
    };
  }

  private isStopword(word: string): boolean {
      const stopwords = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'your', 'have', 'are']);
      return stopwords.has(word);
  }

  private computeBlockSignature(items: any[]): BlockSignature[] {
      // MVP: Divide page into a grid (e.g. 4x4) and compute density
      // For a real layout analysis, we'd use DBSCAN or similar.
      // Here, we'll return a simplified signature: top 5 densest 10% vertical strips?
      // Let's implement the prompt's request: "Identify table-like areas by high text density"
      
      // Simple heuristic: Grid 10x10.
      const grid: number[][] = Array(10).fill(0).map(() => Array(10).fill(0));
      
      items.forEach(item => {
          const gx = Math.min(9, Math.floor(item.x * 10));
          const gy = Math.min(9, Math.floor(item.y * 10));
          grid[gy][gx]++;
      });

      const blocks: BlockSignature[] = [];
      // Find cells with > threshold
      for(let y=0; y<10; y++) {
          for(let x=0; x<10; x++) {
              if (grid[y][x] > 5) { // Arbitrary density threshold
                  blocks.push({
                      page: 1, // Simplified to page 1 for now
                      region_id: y*10 + x,
                      bbox_norm: {
                          x0: x/10, y0: y/10,
                          x1: (x+1)/10, y1: (y+1)/10
                      },
                      density: grid[y][x]
                  });
              }
          }
      }
      return blocks;
  }

  private computeColumnSignature(items: any[]): ColumnXSignature[] {
      // Project text onto X axis
      const xBuckets = new Map<string, number>();
      
      items.forEach(item => {
          // Round to nearest 0.05 (5%)
          const x = Math.round(item.x * 20) / 20;
          xBuckets.set(x.toString(), (xBuckets.get(x.toString()) || 0) + 1);
      });

      // Find peaks
      const xs_norm = Array.from(xBuckets.entries())
          .filter(([x, count]) => count > 5) // Min 5 items to constitute a column
          .map(([x]) => parseFloat(x))
          .sort((a, b) => a - b);

      return [{
          page: 1,
          xs_norm
      }];
  }

  private computeHeaderFooterHash(items: any[]): HeaderFooterSignature {
      // Header: top 10% (y < 0.1)
      // Footer: bottom 10% (y > 0.9)
      const headerText = items.filter(i => i.y < 0.1).map(i => i.str).join('');
      const footerText = items.filter(i => i.y > 0.9).map(i => i.str).join('');
      
      return {
          header_text_hash: crypto.createHash('md5').update(headerText).digest('hex'),
          footer_text_hash: crypto.createHash('md5').update(footerText).digest('hex')
      };
  }
}
