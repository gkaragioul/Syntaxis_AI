
export interface TableResult {
  headers: string[];
  rows: string[][];
  metadata?: Record<string, any>;
}

export class TreasuryConsolidationParser {
  private static readonly HEADER_START_REGEX = /\|\s*Head of Account/;
  private static readonly SEPARATOR_REGEX = /^-+$/;

  /**
   * Checks if the text content matches the Treasury Consolidation template
   */
  static matches(text: string): boolean {
    return (
      text.includes('GOVERNMENT OF PUDUCHERRY') &&
      text.includes('Consolidation') &&
      this.HEADER_START_REGEX.test(text)
    );
  }

  /**
   * Parses the text to extract the consolidation table
   */
  static parse(text: string): TableResult {
    const lines = text.split('\n');
    let extractionStarted = false;
    let headers: string[] = [];
    const rows: string[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (this.HEADER_START_REGEX.test(line)) {
        // Found header
        // Header line format: | Head of Account | D.A.T Pondy | ... |
        // We split by pipe and filter out empty strings resulting from leading/trailing pipes
        headers = line
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c !== '');
        extractionStarted = true;
        continue;
      }

      if (extractionStarted) {
        if (this.SEPARATOR_REGEX.test(line)) {
          continue; // Skip separator lines
        }

        // Check if line looks like a data row (starts with |)
        if (line.startsWith('|')) {
          const cols = line.split('|').map((c) => c.trim());
          
          // Remove the first and last empty elements caused by the leading/trailing pipes
          // Example: "| data | data |" splits to ["", "data", "data", ""]
          if (cols.length > 0 && cols[0] === '') cols.shift();
          if (cols.length > 0 && cols[cols.length - 1] === '') cols.pop();

          // If it's a valid row with data (not just empty pipes or empty strings)
          if (cols.length > 0 && cols.some(c => c !== '')) {
             rows.push(cols);
          }
        } else if (line === '') {
            // Empty line might mean end of table section on this page, but 
            // PDF text extraction often produces gaps. We'll continue unless we see a clear footer.
            // For this specific template, we keep going.
        }
      }
    }

    return {
      headers,
      rows,
      metadata: {
        type: 'TREASURY_CONSOLIDATION',
        detectedAt: new Date(),
      },
    };
  }
}
