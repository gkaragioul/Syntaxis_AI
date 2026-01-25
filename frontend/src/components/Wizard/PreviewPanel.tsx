import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  analyzeExtractionQuality,
  applyCleanup,
  getConfidenceColor,
  getConfidenceLabel,
  ExtractionQualityMetrics,
} from './extractionQuality';
import { BboxNorm, HeaderDetection } from '../../services/wizardService';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface ReExtractOptions {
  useGridColumns?: boolean;
}

interface PreviewPanelProps {
  headers: string[];
  rows: string[][];
  totalRows: number;
  pdfUrl?: string;
  tableRegion?: BboxNorm | null;
  columnGuides?: number[];
  headerRowIndex: number;
  onHeaderRowIndexChange: (index: number) => void;
  onColumnGuidesChange?: (guides: number[]) => void;
  onReExtract?: (options?: ReExtractOptions) => void;
  isLoading?: boolean;
  hasGridLines?: boolean;
  headerDetection?: HeaderDetection | null;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  headers,
  rows,
  totalRows: _totalRows,
  pdfUrl,
  tableRegion,
  columnGuides = [],
  headerRowIndex,
  onHeaderRowIndexChange,
  onColumnGuidesChange: _onColumnGuidesChange,
  onReExtract,
  isLoading = false,
  hasGridLines = false,
  headerDetection,
}) => {
  // Note: totalRows and onColumnGuidesChange are reserved for future use
  void _totalRows;
  void _onColumnGuidesChange;
  // Cleanup options state
  const [dropTopRows, setDropTopRows] = useState(0);
  const [removeSeparators, setRemoveSeparators] = useState(true);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [showFixPanel, setShowFixPanel] = useState(false);
  const [useGridColumns, setUseGridColumns] = useState(false);

  // Header picker state
  const [showHeaderPicker, setShowHeaderPicker] = useState(false);
  const [headerApplied, setHeaderApplied] = useState(false);

  // PDF viewer state
  const [pdfScale, setPdfScale] = useState(0.5);
  const [pdfPageWidth, setPdfPageWidth] = useState(0);
  const [pdfPageHeight, setPdfPageHeight] = useState(0);

  // Auto-apply header detection when it arrives
  useEffect(() => {
    if (headerDetection && !headerApplied) {
      // Apply the detected header index
      onHeaderRowIndexChange(headerDetection.headerIndex);
      setHeaderApplied(true);

      // If confidence is low, show the picker modal
      if (headerDetection.confidence < 0.6) {
        setShowHeaderPicker(true);
      }
    }
  }, [headerDetection, headerApplied, onHeaderRowIndexChange]);

  // Reset applied flag when headerDetection changes (new extraction)
  useEffect(() => {
    if (!headerDetection) {
      setHeaderApplied(false);
    }
  }, [headerDetection]);

  // Analyze extraction quality
  const qualityMetrics = useMemo<ExtractionQualityMetrics>(() => {
    return analyzeExtractionQuality(headers, rows);
  }, [headers, rows]);

  // Apply cleanup transformations
  const cleanedData = useMemo(() => {
    return applyCleanup(headers, rows, {
      dropTopRows,
      removeSeparators,
      trimWhitespace,
    });
  }, [headers, rows, dropTopRows, removeSeparators, trimWhitespace]);

  // Auto-suggest drop rows when quality is bad
  React.useEffect(() => {
    if (qualityMetrics.hasHeaderJunk && dropTopRows === 0) {
      const suggestion = qualityMetrics.recommendations.find(r => r.action === 'drop_rows');
      if (suggestion?.autoValue && typeof suggestion.autoValue === 'number') {
        setDropTopRows(suggestion.autoValue);
      }
    }
  }, [qualityMetrics, dropTopRows]);

  // Handle PDF page load
  const handlePageLoadSuccess = useCallback(({ width, height }: { width: number; height: number }) => {
    setPdfPageWidth(width);
    setPdfPageHeight(height);
  }, []);

  // Download sample CSV
  const handleDownloadCSV = useCallback(() => {
    const { headers: h, rows: r } = cleanedData;
    const csvContent = [
      h.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','),
      ...r.slice(0, 50).map(row =>
        row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'preview_sample.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }, [cleanedData]);

  const confidenceColor = getConfidenceColor(qualityMetrics.confidenceScore);
  const confidenceLabel = getConfidenceLabel(qualityMetrics.confidenceScore);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar with stats and confidence */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            <strong>{cleanedData.headers.length}</strong> columns × <strong>{cleanedData.rows.length}</strong> rows
          </span>

          {/* Confidence badge */}
          <span
            className={`
              inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
              ${confidenceColor === 'green' ? 'bg-green-100 text-green-800' : ''}
              ${confidenceColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' : ''}
              ${confidenceColor === 'red' ? 'bg-red-100 text-red-800' : ''}
            `}
          >
            {confidenceLabel} ({qualityMetrics.confidenceScore}%)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Sample CSV
          </button>
        </div>
      </div>

      {/* Bad extraction warning banner */}
      {qualityMetrics.isLikelyBadExtraction && (
        <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Extraction issues detected</h3>
              <div className="mt-1 text-sm text-red-700">
                {qualityMetrics.issues.map((issue, idx) => (
                  <p key={idx}>• {issue.message}</p>
                ))}
              </div>
              <button
                onClick={() => setShowFixPanel(!showFixPanel)}
                className="mt-2 text-sm font-medium text-red-800 hover:text-red-900 underline"
              >
                {showFixPanel ? 'Hide fix options' : 'Show fix options'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fix extraction panel */}
      {(showFixPanel || qualityMetrics.issues.length > 0) && (
        <div className="flex-shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-3">
          <h4 className="text-sm font-medium text-blue-800 mb-3">Fix extraction settings</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Header row auto-detect */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Header row
              </label>
              <div className="flex items-center gap-2">
                {headerDetection ? (
                  <>
                    <span className={`
                      inline-flex items-center px-2 py-1 rounded text-xs font-medium
                      ${headerDetection.confidence >= 0.7 ? 'bg-green-100 text-green-800' : ''}
                      ${headerDetection.confidence >= 0.4 && headerDetection.confidence < 0.7 ? 'bg-yellow-100 text-yellow-800' : ''}
                      ${headerDetection.confidence < 0.4 ? 'bg-red-100 text-red-800' : ''}
                    `}>
                      Row {headerRowIndex + 1}
                      {headerDetection.confidence >= 0.7 && ' (auto-detected)'}
                      {headerDetection.confidence < 0.7 && headerDetection.confidence >= 0.4 && ' (uncertain)'}
                      {headerDetection.confidence < 0.4 && ' (needs review)'}
                    </span>
                    <button
                      onClick={() => setShowHeaderPicker(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Pick different row
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">Detecting header...</span>
                )}
              </div>
            </div>

            {/* Remove separators checkbox */}
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={removeSeparators}
                  onChange={(e) => setRemoveSeparators(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 mr-2"
                />
                <span className="text-xs text-gray-700">Remove separators</span>
              </label>
            </div>

            {/* Trim whitespace checkbox */}
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={trimWhitespace}
                  onChange={(e) => setTrimWhitespace(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 mr-2"
                />
                <span className="text-xs text-gray-700">Trim whitespace</span>
              </label>
            </div>
          </div>

          {/* Column detection mode */}
          <div className="mt-3 p-2 bg-white rounded border border-gray-200">
            <span className="text-xs font-medium text-gray-700 mr-3">Column detection:</span>
            <label className="inline-flex items-center mr-4">
              <input
                type="radio"
                checked={!useGridColumns}
                onChange={() => setUseGridColumns(false)}
                className="text-blue-600 mr-1"
              />
              <span className="text-xs text-gray-700">Text alignment</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={useGridColumns}
                onChange={() => setUseGridColumns(true)}
                className="text-blue-600 mr-1"
              />
              <span className="text-xs text-gray-700">Grid lines {hasGridLines && '(detected)'}</span>
            </label>
          </div>

          {/* Re-extract button */}
          {onReExtract && (
            <button
              onClick={() => onReExtract({ useGridColumns })}
              disabled={isLoading}
              className="mt-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Re-extracting...' : 'Re-extract with these settings'}
            </button>
          )}
        </div>
      )}

      {/* Main content - split view */}
      <div className="flex-1 min-h-0 flex">
        {/* Left: Mini PDF viewer with overlays */}
        {pdfUrl && tableRegion && (
          <div className="w-2/5 border-r border-gray-200 p-2 overflow-auto bg-gray-100">
            <div className="relative inline-block">
              <Document
                file={pdfUrl}
                loading={<div className="text-sm text-gray-500">Loading PDF...</div>}
                error={<div className="text-sm text-red-500">Failed to load PDF</div>}
              >
                <Page
                  pageNumber={1}
                  scale={pdfScale}
                  onLoadSuccess={handlePageLoadSuccess}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>

              {/* Table region overlay */}
              {pdfPageWidth > 0 && pdfPageHeight > 0 && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                  style={{
                    left: `${tableRegion.x0 * pdfPageWidth * pdfScale}px`,
                    top: `${tableRegion.y0 * pdfPageHeight * pdfScale}px`,
                    width: `${(tableRegion.x1 - tableRegion.x0) * pdfPageWidth * pdfScale}px`,
                    height: `${(tableRegion.y1 - tableRegion.y0) * pdfPageHeight * pdfScale}px`,
                  }}
                />
              )}

              {/* Column guide overlays (red vertical lines) */}
              {pdfPageWidth > 0 && columnGuides.map((guide, idx) => (
                <div
                  key={idx}
                  className="absolute w-0.5 bg-red-500 opacity-75 pointer-events-none"
                  style={{
                    left: `${guide * pdfPageWidth * pdfScale}px`,
                    top: `${(tableRegion?.y0 || 0) * pdfPageHeight * pdfScale}px`,
                    height: `${((tableRegion?.y1 || 1) - (tableRegion?.y0 || 0)) * pdfPageHeight * pdfScale}px`,
                  }}
                />
              ))}

              {/* Column count indicator */}
              {pdfPageWidth > 0 && columnGuides.length > 0 && (
                <div
                  className="absolute bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-sm pointer-events-none"
                  style={{
                    left: `${(tableRegion?.x0 || 0) * pdfPageWidth * pdfScale + 4}px`,
                    top: `${(tableRegion?.y0 || 0) * pdfPageHeight * pdfScale - 18}px`,
                  }}
                >
                  {columnGuides.length + 1} columns
                </div>
              )}

              {/* Header row indicator - show a thin band at the detected header position */}
              {pdfPageWidth > 0 && pdfPageHeight > 0 && tableRegion && headerRowIndex >= 0 && (
                <div
                  className="absolute border-2 border-yellow-500 bg-yellow-500/20 pointer-events-none"
                  style={{
                    left: `${tableRegion.x0 * pdfPageWidth * pdfScale}px`,
                    // Estimate row position based on header index
                    top: `${(tableRegion.y0 + (tableRegion.y1 - tableRegion.y0) * (headerRowIndex / Math.max(cleanedData.rows.length + 1, 10)) * 0.9) * pdfPageHeight * pdfScale}px`,
                    width: `${(tableRegion.x1 - tableRegion.x0) * pdfPageWidth * pdfScale}px`,
                    // Single row height estimate
                    height: `${Math.min(
                      ((tableRegion.y1 - tableRegion.y0) * pdfPageHeight * pdfScale) / Math.max(cleanedData.rows.length + 1, 10),
                      30
                    )}px`,
                  }}
                />
              )}
            </div>

            {/* Zoom controls */}
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setPdfScale(s => Math.max(0.2, s - 0.1))}
                className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
              >
                −
              </button>
              <span className="text-xs text-gray-600">{Math.round(pdfScale * 100)}%</span>
              <button
                onClick={() => setPdfScale(s => Math.min(2, s + 0.1))}
                className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Right: Data table preview */}
        <div className={`${pdfUrl && tableRegion ? 'w-3/5' : 'w-full'} overflow-auto`}>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            {/* Header */}
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-10">#</th>
                {cleanedData.headers.map((header, i) => (
                  <th
                    key={i}
                    className="px-2 py-2 text-left text-xs font-medium text-gray-700 max-w-[200px] truncate"
                    title={header || `Column ${i + 1}`}
                  >
                    {header || `Col ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="bg-white divide-y divide-gray-100">
              {cleanedData.rows.slice(0, 50).map((row, rowIdx) => {
                // Check if this row looks like a separator
                const rowText = row.join('');
                const isSeparator = /^[-=_\s|]+$/.test(rowText);

                return (
                  <tr
                    key={rowIdx}
                    className={`
                      hover:bg-gray-50
                      ${isSeparator ? 'bg-yellow-50' : ''}
                    `}
                  >
                    <td className="px-2 py-1 text-xs text-gray-400">{rowIdx + 1}</td>
                    {cleanedData.headers.map((_, colIdx) => {
                      const cell = row[colIdx] || '';
                      const hasPipe = cell.includes('|');
                      return (
                        <td
                          key={colIdx}
                          className={`
                            px-2 py-1 text-xs text-gray-900 max-w-[200px] truncate
                            ${hasPipe ? 'bg-red-50 text-red-800' : ''}
                          `}
                          title={cell}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* More rows indicator */}
          {cleanedData.rows.length > 50 && (
            <div className="bg-gray-50 px-4 py-2 text-center text-sm text-gray-500">
              + {cleanedData.rows.length - 50} more rows (showing first 50)
            </div>
          )}

          {/* Empty state */}
          {cleanedData.rows.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No data to preview. Adjust your table selection.
            </div>
          )}
        </div>
      </div>

      {/* Header Picker Modal */}
      {showHeaderPicker && headerDetection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Pick the header row</h3>
              <button
                onClick={() => setShowHeaderPicker(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-auto p-4">
              <p className="text-sm text-gray-600 mb-4">
                Click on the row that contains your column headers:
              </p>

              <div className="space-y-1">
                {headerDetection.candidates.slice(0, 15).map((candidate) => {
                  const isSelected = candidate.index === headerRowIndex;
                  const isRecommended = candidate.index === headerDetection.headerIndex;
                  const isBlocked = candidate.isTitleRow || candidate.isSeparator;

                  return (
                    <button
                      key={candidate.index}
                      onClick={() => {
                        onHeaderRowIndexChange(candidate.index);
                        setShowHeaderPicker(false);
                      }}
                      disabled={isBlocked}
                      className={`
                        w-full text-left px-3 py-2 rounded border transition-colors
                        ${isSelected ? 'border-blue-500 bg-blue-50' : ''}
                        ${isBlocked ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' : ''}
                        ${!isSelected && !isBlocked ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50' : ''}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono w-8 ${isBlocked ? 'text-gray-400' : 'text-gray-500'}`}>
                            Row {candidate.index + 1}
                          </span>
                          <span className={`text-sm truncate max-w-md ${isBlocked ? 'text-gray-400' : 'text-gray-900'}`}>
                            {candidate.preview || '(empty)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isRecommended && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                          {candidate.qualifies && !isRecommended && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              Valid header
                            </span>
                          )}
                          {candidate.isSeparator && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                              Separator
                            </span>
                          )}
                          {candidate.isTitleRow && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                              Title/metadata
                            </span>
                          )}
                          {candidate.headerKeywords > 0 && !isBlocked && !candidate.qualifies && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {candidate.headerKeywords} keyword(s)
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowHeaderPicker(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowHeaderPicker(false)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewPanel;
