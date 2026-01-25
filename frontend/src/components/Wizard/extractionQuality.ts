/**
 * Extraction Quality Analysis
 * Detects bad extractions and provides recommendations for fixes
 */

export interface ExtractionQualityMetrics {
  // Core metrics
  pipeRate: number; // % rows containing | or long runs of ----/====
  avgCellLength: number[];  // Average cell length per column
  emptyRowRate: number; // % of rows that are mostly empty
  headerJunkRate: number; // % of first 10 rows with junk phrases
  singleColumnRate: number; // % rows with only 1 non-empty column
  separatorRowRate: number; // % rows that look like separators

  // Derived flags
  hasPipeDelimitedData: boolean;
  hasHeaderJunk: boolean;
  hasCollapsedColumns: boolean;
  hasSeparatorRows: boolean;

  // Overall assessment
  isLikelyBadExtraction: boolean;
  confidenceScore: number; // 0-100, higher = better extraction
  issues: ExtractionIssue[];
  recommendations: ExtractionRecommendation[];
}

export interface ExtractionIssue {
  type: 'pipe_delimited' | 'header_junk' | 'collapsed_columns' | 'separator_rows' | 'few_columns';
  severity: 'warning' | 'error';
  message: string;
  affectedRows?: number[];
}

export interface ExtractionRecommendation {
  action: 'drop_rows' | 'use_grid_lines' | 'remove_separators' | 'adjust_columns';
  label: string;
  description: string;
  autoValue?: number | boolean;
}

// Junk phrases commonly found in headers/titles
const HEADER_JUNK_PATTERNS = [
  /government\s+of/i,
  /consolidat/i,
  /state\s+(?:debit|credit)/i,
  /page\s*(?:no|#|\d)/i,
  /report(?:ing)?\s+(?:date|period)/i,
  /month\s+(?:of|ending)/i,
  /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/, // Date patterns
  /directorate/i,
  /ministry/i,
  /department\s+of/i,
  /fiscal\s+year/i,
  /accounting\s+period/i,
];

// Separator patterns (expanded for government reports)
const SEPARATOR_PATTERNS = [
  /^[-=_\s|]+$/, // Only dashes, equals, underscores, spaces, pipes
  /^[\s|]*-{3,}[\s|]*$/, // Long dash runs
  /^[\s|]*={3,}[\s|]*$/, // Long equals runs
  /^[\s\-\|=_\+\.]{10,}$/, // Repeated separator chars (matching backend)
  /^\|[-\s|]+\|$/, // Pipe-surrounded separator (| --- | --- |)
];

// Title/metadata patterns to filter from header area
const TITLE_PATTERNS = [
  /^\s*government\s+of/i,
  /^\s*republic\s+of/i,
  /^\s*state\s+of/i,
  /^\s*ministry\s+of/i,
  /^\s*department\s+of/i,
  /^\s*office\s+of/i,
  /consolidat.*statement/i,
  /financial.*statement/i,
  /^\s*page\s*\d/i,
  /^\s*report\s+(date|period|for)/i,
];

/**
 * Analyze extracted data for quality issues
 */
export function analyzeExtractionQuality(
  headers: string[],
  rows: string[][]
): ExtractionQualityMetrics {
  const allRows = [headers, ...rows];
  const totalRows = allRows.length;
  const issues: ExtractionIssue[] = [];
  const recommendations: ExtractionRecommendation[] = [];

  // 1. Calculate pipe rate
  let pipeRowCount = 0;
  const rowsWithPipes: number[] = [];
  allRows.forEach((row, idx) => {
    const rowText = row.join(' ');
    if (rowText.includes('|') || /[-=]{5,}/.test(rowText)) {
      pipeRowCount++;
      rowsWithPipes.push(idx);
    }
  });
  const pipeRate = totalRows > 0 ? pipeRowCount / totalRows : 0;

  // 2. Calculate header junk rate (first 10 rows)
  const firstRows = allRows.slice(0, Math.min(10, allRows.length));
  let junkRowCount = 0;
  const junkRows: number[] = [];
  firstRows.forEach((row, idx) => {
    const rowText = row.join(' ');
    if (HEADER_JUNK_PATTERNS.some(pattern => pattern.test(rowText))) {
      junkRowCount++;
      junkRows.push(idx);
    }
  });
  const headerJunkRate = firstRows.length > 0 ? junkRowCount / firstRows.length : 0;

  // 3. Calculate average cell length per column
  const avgCellLength: number[] = [];
  const numCols = headers.length;
  for (let col = 0; col < numCols; col++) {
    let totalLen = 0;
    let count = 0;
    allRows.forEach(row => {
      if (row[col] !== undefined) {
        totalLen += (row[col] || '').trim().length;
        count++;
      }
    });
    avgCellLength.push(count > 0 ? totalLen / count : 0);
  }

  // 4. Calculate empty row rate
  let emptyRowCount = 0;
  allRows.forEach(row => {
    const nonEmptyCount = row.filter(cell => (cell || '').trim().length > 0).length;
    if (nonEmptyCount <= 1) {
      emptyRowCount++;
    }
  });
  const emptyRowRate = totalRows > 0 ? emptyRowCount / totalRows : 0;

  // 5. Calculate single column rate (rows with only 1 non-empty cell)
  let singleColumnCount = 0;
  const singleColumnRows: number[] = [];
  allRows.forEach((row, idx) => {
    const nonEmptyCells = row.filter(cell => (cell || '').trim().length > 0);
    if (nonEmptyCells.length === 1 && nonEmptyCells[0].length > 50) {
      singleColumnCount++;
      singleColumnRows.push(idx);
    }
  });
  const singleColumnRate = totalRows > 0 ? singleColumnCount / totalRows : 0;

  // 6. Calculate separator row rate
  let separatorRowCount = 0;
  const separatorRows: number[] = [];
  allRows.forEach((row, idx) => {
    const rowText = row.join('');
    if (SEPARATOR_PATTERNS.some(pattern => pattern.test(rowText))) {
      separatorRowCount++;
      separatorRows.push(idx);
    }
  });
  const separatorRowRate = totalRows > 0 ? separatorRowCount / totalRows : 0;

  // Derive flags
  const hasPipeDelimitedData = pipeRate > 0.15;
  const hasHeaderJunk = headerJunkRate > 0.20;
  const hasCollapsedColumns = numCols < 3 && singleColumnRate > 0.3;
  const hasSeparatorRows = separatorRowRate > 0.1;

  // Build issues list
  if (hasPipeDelimitedData) {
    issues.push({
      type: 'pipe_delimited',
      severity: 'error',
      message: 'Data appears to be pipe-delimited text, not properly split columns.',
      affectedRows: rowsWithPipes.slice(0, 5),
    });
    recommendations.push({
      action: 'use_grid_lines',
      label: 'Use grid-line detection',
      description: 'Extract column boundaries from PDF grid lines instead of text alignment.',
      autoValue: true,
    });
  }

  if (hasHeaderJunk) {
    issues.push({
      type: 'header_junk',
      severity: 'warning',
      message: 'Report title or metadata found in header area.',
      affectedRows: junkRows,
    });
    recommendations.push({
      action: 'drop_rows',
      label: `Drop first ${junkRowCount} rows`,
      description: 'Remove report title and metadata rows from the top.',
      autoValue: junkRowCount,
    });
  }

  if (hasCollapsedColumns) {
    issues.push({
      type: 'collapsed_columns',
      severity: 'error',
      message: 'Columns appear to be merged into single cells.',
      affectedRows: singleColumnRows.slice(0, 5),
    });
    recommendations.push({
      action: 'adjust_columns',
      label: 'Re-detect columns',
      description: 'Run column detection again with different settings.',
    });
  }

  if (hasSeparatorRows) {
    issues.push({
      type: 'separator_rows',
      severity: 'warning',
      message: 'Separator rows (dashes/lines) detected in data.',
      affectedRows: separatorRows.slice(0, 5),
    });
    recommendations.push({
      action: 'remove_separators',
      label: 'Remove separator rows',
      description: 'Filter out rows that only contain dashes or separator characters.',
      autoValue: true,
    });
  }

  if (numCols < 3 && !hasCollapsedColumns) {
    issues.push({
      type: 'few_columns',
      severity: 'warning',
      message: `Only ${numCols} column(s) detected. Expected more for tabular data.`,
    });
  }

  // Calculate confidence score
  let confidence = 100;
  if (hasPipeDelimitedData) confidence -= 40;
  if (hasHeaderJunk) confidence -= 15;
  if (hasCollapsedColumns) confidence -= 35;
  if (hasSeparatorRows) confidence -= 10;
  if (emptyRowRate > 0.3) confidence -= 10;
  confidence = Math.max(0, Math.min(100, confidence));

  const isLikelyBadExtraction = confidence < 60 || hasPipeDelimitedData || hasCollapsedColumns;

  return {
    pipeRate,
    avgCellLength,
    emptyRowRate,
    headerJunkRate,
    singleColumnRate,
    separatorRowRate,
    hasPipeDelimitedData,
    hasHeaderJunk,
    hasCollapsedColumns,
    hasSeparatorRows,
    isLikelyBadExtraction,
    confidenceScore: confidence,
    issues,
    recommendations,
  };
}

/**
 * Check if a row looks like a title/metadata row (not data)
 */
export function isTitleRow(row: string[]): boolean {
  const rowText = row.join(' ');
  return TITLE_PATTERNS.some(pattern => pattern.test(rowText));
}

/**
 * Check if a row looks like a separator row
 */
export function isSeparatorRow(row: string[]): boolean {
  const rowText = row.join('');
  return SEPARATOR_PATTERNS.some(pattern => pattern.test(rowText));
}

/**
 * Apply cleanup transformations to extracted data
 */
export function applyCleanup(
  headers: string[],
  rows: string[][],
  options: {
    dropTopRows?: number;
    removeSeparators?: boolean;
    trimWhitespace?: boolean;
    headerRowIndex?: number;
    removeTitleRows?: boolean;
  }
): { headers: string[]; rows: string[][] } {
  let cleanedRows = [...rows];
  let cleanedHeaders = [...headers];

  // 1. Drop top rows
  if (options.dropTopRows && options.dropTopRows > 0) {
    // If we're dropping rows, we need to shift headers too
    if (options.dropTopRows === 1 && cleanedRows.length > 0) {
      // New headers come from first data row
      cleanedHeaders = cleanedRows[0] || cleanedHeaders;
      cleanedRows = cleanedRows.slice(1);
    } else if (options.dropTopRows > 1 && cleanedRows.length >= options.dropTopRows) {
      // Multiple rows to drop - use the last dropped row as headers
      cleanedHeaders = cleanedRows[options.dropTopRows - 1] || cleanedHeaders;
      cleanedRows = cleanedRows.slice(options.dropTopRows);
    }
  }

  // 2. Use specific header row index
  if (options.headerRowIndex !== undefined && options.headerRowIndex >= 0) {
    const allData = [cleanedHeaders, ...cleanedRows];
    if (options.headerRowIndex < allData.length) {
      cleanedHeaders = allData[options.headerRowIndex];
      cleanedRows = allData.slice(options.headerRowIndex + 1);
    }
  }

  // 3. Remove title/metadata rows from data (above the header)
  if (options.removeTitleRows) {
    cleanedRows = cleanedRows.filter(row => !isTitleRow(row));
  }

  // 4. Remove separator rows
  if (options.removeSeparators) {
    cleanedRows = cleanedRows.filter(row => !isSeparatorRow(row));
  }

  // 5. Trim whitespace
  if (options.trimWhitespace) {
    cleanedHeaders = cleanedHeaders.map(h => (h || '').trim());
    cleanedRows = cleanedRows.map(row => row.map(cell => (cell || '').trim()));
  }

  // 6. Remove empty leading/trailing columns
  if (options.trimWhitespace) {
    // Find first and last non-empty column indices
    let firstNonEmpty = 0;
    let lastNonEmpty = cleanedHeaders.length - 1;

    for (let i = 0; i < cleanedHeaders.length; i++) {
      const colHasData = cleanedHeaders[i]?.trim() ||
        cleanedRows.some(row => row[i]?.trim());
      if (colHasData) {
        firstNonEmpty = i;
        break;
      }
    }

    for (let i = cleanedHeaders.length - 1; i >= 0; i--) {
      const colHasData = cleanedHeaders[i]?.trim() ||
        cleanedRows.some(row => row[i]?.trim());
      if (colHasData) {
        lastNonEmpty = i;
        break;
      }
    }

    if (firstNonEmpty > 0 || lastNonEmpty < cleanedHeaders.length - 1) {
      cleanedHeaders = cleanedHeaders.slice(firstNonEmpty, lastNonEmpty + 1);
      cleanedRows = cleanedRows.map(row => row.slice(firstNonEmpty, lastNonEmpty + 1));
    }
  }

  return { headers: cleanedHeaders, rows: cleanedRows };
}

/**
 * Get confidence level badge color
 */
export function getConfidenceColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

/**
 * Get confidence label
 */
export function getConfidenceLabel(score: number): string {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Poor';
}
