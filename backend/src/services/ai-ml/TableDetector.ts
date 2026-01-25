
export interface BoundingBox {
  vertices: { x: number; y: number }[];
}

export interface TextBlock {
  text: string;
  boundingBox: BoundingBox;
}

export interface DetectedTable {
  headers: string[];
  rows: string[][];
  confidence: number;
  boundingBox: BoundingBox;
}

export class TableDetector {
  /**
   * Detects tables from a list of text blocks with bounding boxes
   */
  detectTables(blocks: TextBlock[]): DetectedTable[] {
    // 1. Group text into lines based on Y-coordinates
    const lines = this.groupIntoLines(blocks);
    
    // 2. Identify potential header lines
    // Heuristic: Headers are often at the top of a dense text block and have good horizontal spacing
    const potentialHeaders = this.findPotentialHeaders(lines);
    
    // 3. For each header, try to build a table downwards
    const tables: DetectedTable[] = [];
    
    for (const headerLine of potentialHeaders) {
        const table = this.buildTableFromHeader(headerLine, lines);
        if (table) {
            tables.push(table);
        }
    }
    
    return tables;
  }

  private groupIntoLines(blocks: TextBlock[]): TextBlock[][] {
    // Sort blocks by Y coordinate
    const sorted = [...blocks].sort((a, b) => this.getMinY(a) - this.getMinY(b));
    
    const lines: TextBlock[][] = [];
    let currentLine: TextBlock[] = [];
    
    for (const block of sorted) {
        if (currentLine.length === 0) {
            currentLine.push(block);
        } else {
            const prev = currentLine[currentLine.length - 1];
            // Check vertical overlap to see if they are on the same line
            if (this.isSameLine(prev, block)) {
                currentLine.push(block);
            } else {
                // Sort line by X coordinate
                currentLine.sort((a, b) => this.getMinX(a) - this.getMinX(b));
                lines.push(currentLine);
                currentLine = [block];
            }
        }
    }
    
    if (currentLine.length > 0) {
        currentLine.sort((a, b) => this.getMinX(a) - this.getMinX(b));
        lines.push(currentLine);
    }
    
    return lines;
  }

  private isSameLine(a: TextBlock, b: TextBlock): boolean {
    const aY = this.getCenterY(a);
    const bY = this.getCenterY(b);
    const height = Math.max(this.getHeight(a), this.getHeight(b));
    return Math.abs(aY - bY) < height * 0.5; // 50% overlap tolerance
  }

  private findPotentialHeaders(lines: TextBlock[][]): number[] {
      const headerIndices: number[] = [];
      
      // Look for lines that have multiple distinct elements (columns)
      // and are followed by lines with similar structure
      for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.length >= 2) { // Minimum 2 columns
              // Check alignment with next line
              const nextLine = lines[i+1];
              if (this.checkColumnAlignment(line, nextLine)) {
                  headerIndices.push(i);
              }
          }
      }
      return headerIndices;
  }
  
  private checkColumnAlignment(header: TextBlock[], row: TextBlock[]): boolean {
      // Simplified alignment check: meaningful overlap in X coordinates
      let matches = 0;
      for (const hCol of header) {
          for (const rCol of row) {
              if (this.xOverlap(hCol, rCol)) {
                  matches++;
                  break; 
              }
          }
      }
      // If at least 50% of header columns have a matching data cell below
      return matches >= header.length * 0.5;
  }
  
  private buildTableFromHeader(headerIndex: number, lines: TextBlock[][]): DetectedTable | null {
      const headers = lines[headerIndex].map(b => b.text);
      const rows: string[][] = [];
      const headerBlocks = lines[headerIndex];
      
      let rowIndex = headerIndex + 1;
      let consecutiveMisses = 0;
      
      while (rowIndex < lines.length) {
          const rowBlocks = lines[rowIndex];
          
          // Try to map blocks to header columns
          const rowData = new Array(headers.length).fill('');
          let matchedAny = false;
          
          for (const block of rowBlocks) {
              let matchedCol = -1;
              let bestOverlap = 0;
              
              // Find best matching column
              for (let i = 0; i < headers.length; i++) {
                  const hBlock = headerBlocks[i];
                  const overlap = this.calculateXOverlap(hBlock, block);
                  if (overlap > bestOverlap) {
                      bestOverlap = overlap;
                      matchedCol = i;
                  }
              }
              
              if (matchedCol !== -1 && bestOverlap > 0) {
                  rowData[matchedCol] = rowData[matchedCol] ? rowData[matchedCol] + ' ' + block.text : block.text;
                  matchedAny = true;
              }
          }
          
          if (matchedAny) {
              rows.push(rowData);
              consecutiveMisses = 0;
          } else {
              consecutiveMisses++;
          }
          
          // Stop if too many non-matching lines (end of table)
          if (consecutiveMisses > 3) break;
          
          rowIndex++;
      }
      
      if (rows.length > 0) {
          return {
              headers,
              rows,
              confidence: 0.8, // Placeholder confidence
              boundingBox: { vertices: [] } // Placeholder
          };
      }
      
      return null;
  }

  // --- Helper Methods ---
  
  private getMinY(block: TextBlock): number {
      return Math.min(...block.boundingBox.vertices.map(v => v.y));
  }
  
  private getMinX(block: TextBlock): number {
      return Math.min(...block.boundingBox.vertices.map(v => v.x));
  }
  
  private getMaxX(block: TextBlock): number {
      return Math.max(...block.boundingBox.vertices.map(v => v.x));
  }
  
  private getCenterY(block: TextBlock): number {
      const ys = block.boundingBox.vertices.map(v => v.y);
      return (Math.min(...ys) + Math.max(...ys)) / 2;
  }
  
  private getHeight(block: TextBlock): number {
      const ys = block.boundingBox.vertices.map(v => v.y);
      return Math.max(...ys) - Math.min(...ys);
  }
  
  private xOverlap(a: TextBlock, b: TextBlock): boolean {
      const aMin = this.getMinX(a);
      const aMax = this.getMaxX(a);
      const bMin = this.getMinX(b);
      const bMax = this.getMaxX(b);
      return Math.max(aMin, bMin) < Math.min(aMax, bMax);
  }
  
  private calculateXOverlap(header: TextBlock, cell: TextBlock): number {
      const hMin = this.getMinX(header);
      const hMax = this.getMaxX(header);
      const cMin = this.getMinX(cell);
      const cMax = this.getMaxX(cell);
      
      const overlapStart = Math.max(hMin, cMin);
      const overlapEnd = Math.min(hMax, cMax);
      
      if (overlapEnd > overlapStart) {
          return overlapEnd - overlapStart;
      }
      return 0;
  }
}
