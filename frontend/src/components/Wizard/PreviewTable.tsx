import React from 'react';

interface PreviewTableProps {
  headers: string[];
  rows: string[][];
  totalRows?: number;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({
  headers,
  rows,
  totalRows,
}) => {
  // Show max 10 preview rows
  const previewRows = rows.slice(0, 10);
  const hasMore = rows.length > 10 || (totalRows && totalRows > rows.length);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {headers.length} columns × {totalRows || rows.length} rows
        </span>
        {hasMore && (
          <span className="text-blue-600">
            Showing preview of first {previewRows.length} rows
          </span>
        )}
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            {/* Header */}
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                  #
                </th>
                {headers.map((header, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-[200px]"
                  >
                    <div className="truncate">{header || `Column ${i + 1}`}</div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="bg-white divide-y divide-gray-200">
              {previewRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-400">{rowIdx + 1}</td>
                  {headers.map((_, colIdx) => (
                    <td
                      key={colIdx}
                      className="px-3 py-2 text-sm text-gray-900 max-w-[200px]"
                    >
                      <div className="truncate">{row[colIdx] || ''}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* More rows indicator */}
        {hasMore && (
          <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-center">
            <span className="text-sm text-gray-500">
              + {(totalRows || rows.length) - previewRows.length} more rows
            </span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No data to preview. Adjust your table selection.
        </div>
      )}
    </div>
  );
};

// Mock data generator for preview
export function generateMockPreviewData(): { headers: string[]; rows: string[][] } {
  const headers = ['Date', 'Description', 'Amount', 'Balance'];
  const rows = [
    ['2024-01-01', 'Opening Balance', '', '$10,000.00'],
    ['2024-01-05', 'Wire Transfer In', '$5,000.00', '$15,000.00'],
    ['2024-01-10', 'Vendor Payment - ABC Corp', '-$2,500.00', '$12,500.00'],
    ['2024-01-12', 'Service Fee', '-$25.00', '$12,475.00'],
    ['2024-01-15', 'Customer Payment', '$3,200.00', '$15,675.00'],
    ['2024-01-18', 'Utility Bill', '-$450.00', '$15,225.00'],
    ['2024-01-20', 'Refund', '$150.00', '$15,375.00'],
    ['2024-01-22', 'Insurance Premium', '-$1,200.00', '$14,175.00'],
    ['2024-01-25', 'Interest Credit', '$12.50', '$14,187.50'],
    ['2024-01-31', 'Closing Balance', '', '$14,187.50'],
  ];

  return { headers, rows };
}

export default PreviewTable;
