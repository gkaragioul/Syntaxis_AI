/**
 * Tests for extraction quality analysis and cleanup functions
 */
import {
  analyzeExtractionQuality,
  applyCleanup,
  isTitleRow,
  isSeparatorRow,
  getConfidenceColor,
  getConfidenceLabel,
} from '../../../components/Wizard/extractionQuality';

describe('extractionQuality', () => {
  describe('isSeparatorRow', () => {
    it('should detect rows with only dashes', () => {
      expect(isSeparatorRow(['---', '---', '---'])).toBe(true);
      expect(isSeparatorRow(['----------'])).toBe(true);
    });

    it('should detect pipe-separated separator rows', () => {
      expect(isSeparatorRow(['| --- | --- |'])).toBe(true);
      expect(isSeparatorRow(['|---|---|'])).toBe(true);
    });

    it('should not flag data rows as separators', () => {
      expect(isSeparatorRow(['Amount', 'Date', 'Name'])).toBe(false);
      expect(isSeparatorRow(['100.00', '2024-01-01', 'John'])).toBe(false);
    });
  });

  describe('isTitleRow', () => {
    it('should detect government header rows', () => {
      expect(isTitleRow(['Government of Test State'])).toBe(true);
      expect(isTitleRow(['Ministry of Finance'])).toBe(true);
      expect(isTitleRow(['Department of Revenue'])).toBe(true);
    });

    it('should detect report titles', () => {
      expect(isTitleRow(['Consolidated Financial Statement'])).toBe(true);
      expect(isTitleRow(['Report for Period Ending'])).toBe(true);
    });

    it('should not flag data rows as titles', () => {
      expect(isTitleRow(['Account', 'Debit', 'Credit'])).toBe(false);
      expect(isTitleRow(['100.00', '200.00', '300.00'])).toBe(false);
    });
  });

  describe('analyzeExtractionQuality', () => {
    it('should detect pipe-delimited data', () => {
      const headers = ['Col1 | Col2 | Col3'];
      const rows = [
        ['Data1 | Data2 | Data3'],
        ['Data4 | Data5 | Data6'],
      ];
      const result = analyzeExtractionQuality(headers, rows);
      expect(result.hasPipeDelimitedData).toBe(true);
      expect(result.confidenceScore).toBeLessThan(60);
    });

    it('should detect collapsed columns', () => {
      const headers = ['All data in one column'];
      const rows = [
        ['This is a very long row that should have been split into multiple columns but was not'],
        ['Another row that is way too long for a single column'],
      ];
      const result = analyzeExtractionQuality(headers, rows);
      expect(result.hasCollapsedColumns).toBe(true);
    });

    it('should detect separator rows', () => {
      const headers = ['Col1', 'Col2', 'Col3'];
      const rows = [
        ['Data1', 'Data2', 'Data3'],
        ['---', '---', '---'],
        ['Data4', 'Data5', 'Data6'],
        ['===', '===', '==='],
      ];
      const result = analyzeExtractionQuality(headers, rows);
      expect(result.hasSeparatorRows).toBe(true);
    });

    it('should give high confidence for clean data', () => {
      const headers = ['Amount', 'Date', 'Description', 'Category', 'Status'];
      const rows = [
        ['100.00', '2024-01-01', 'Payment 1', 'Revenue', 'Complete'],
        ['200.00', '2024-01-02', 'Payment 2', 'Revenue', 'Complete'],
        ['300.00', '2024-01-03', 'Payment 3', 'Expense', 'Pending'],
      ];
      const result = analyzeExtractionQuality(headers, rows);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
      expect(result.isLikelyBadExtraction).toBe(false);
    });
  });

  describe('applyCleanup', () => {
    it('should remove separator rows', () => {
      const headers = ['A', 'B', 'C'];
      const rows = [
        ['1', '2', '3'],
        ['---', '---', '---'],
        ['4', '5', '6'],
      ];
      const result = applyCleanup(headers, rows, { removeSeparators: true });
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual(['1', '2', '3']);
      expect(result.rows[1]).toEqual(['4', '5', '6']);
    });

    it('should trim whitespace', () => {
      const headers = ['  A  ', '  B  ', '  C  '];
      const rows = [
        ['  1  ', '  2  ', '  3  '],
      ];
      const result = applyCleanup(headers, rows, { trimWhitespace: true });
      expect(result.headers).toEqual(['A', 'B', 'C']);
      expect(result.rows[0]).toEqual(['1', '2', '3']);
    });

    it('should drop top rows', () => {
      const headers = ['Title'];
      const rows = [
        ['Subtitle'],
        ['Header1', 'Header2'],
        ['Data1', 'Data2'],
      ];
      const result = applyCleanup(headers, rows, { dropTopRows: 2 });
      expect(result.headers).toEqual(['Header1', 'Header2']);
      expect(result.rows[0]).toEqual(['Data1', 'Data2']);
    });

    it('should use specific header row index', () => {
      const headers = ['Not the header'];
      const rows = [
        ['Also not header'],
        ['Col1', 'Col2', 'Col3'],
        ['Data1', 'Data2', 'Data3'],
      ];
      const result = applyCleanup(headers, rows, { headerRowIndex: 2 });
      expect(result.headers).toEqual(['Col1', 'Col2', 'Col3']);
      expect(result.rows[0]).toEqual(['Data1', 'Data2', 'Data3']);
    });

    it('should remove empty leading/trailing columns', () => {
      const headers = ['', 'A', 'B', ''];
      const rows = [
        ['', '1', '2', ''],
        ['', '3', '4', ''],
      ];
      const result = applyCleanup(headers, rows, { trimWhitespace: true });
      expect(result.headers).toEqual(['A', 'B']);
      expect(result.rows[0]).toEqual(['1', '2']);
    });
  });

  describe('getConfidenceColor', () => {
    it('should return green for high scores', () => {
      expect(getConfidenceColor(100)).toBe('green');
      expect(getConfidenceColor(80)).toBe('green');
    });

    it('should return yellow for medium scores', () => {
      expect(getConfidenceColor(79)).toBe('yellow');
      expect(getConfidenceColor(60)).toBe('yellow');
    });

    it('should return red for low scores', () => {
      expect(getConfidenceColor(59)).toBe('red');
      expect(getConfidenceColor(0)).toBe('red');
    });
  });

  describe('getConfidenceLabel', () => {
    it('should return correct labels', () => {
      expect(getConfidenceLabel(100)).toBe('Good');
      expect(getConfidenceLabel(70)).toBe('Fair');
      expect(getConfidenceLabel(30)).toBe('Poor');
    });
  });
});
