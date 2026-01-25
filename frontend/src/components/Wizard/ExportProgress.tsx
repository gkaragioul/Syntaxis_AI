import React from 'react';
import { GroupExportResult, getFileExportStatusLabel } from '../../types/wizard';

interface ExportProgressProps {
  groupName: string;
  exportResult: GroupExportResult;
  onDownload?: () => void;
  onExportAnother?: () => void;
}

export const ExportProgress: React.FC<ExportProgressProps> = ({
  groupName,
  exportResult,
  onDownload,
  onExportAnother,
}) => {
  const isRunning = exportResult.status === 'running';
  const isComplete = exportResult.status === 'completed';

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'exported':
        return (
          <span className="text-green-500">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        );
      case 'needs_review':
        return (
          <span className="text-yellow-500">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        );
      case 'failed':
        return (
          <span className="text-red-500">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="text-gray-300">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">{groupName}</h2>
        <p className="text-gray-600">
          {isRunning
            ? 'Exporting documents...'
            : isComplete
            ? 'Export complete!'
            : 'Preparing export...'}
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Progress</span>
          <span>{exportResult.progress}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              exportResult.failedFiles > 0 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${exportResult.progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-700">
            {exportResult.exportedFiles}
          </div>
          <div className="text-xs text-green-600">Exported</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-700">
            {exportResult.filesWithWarnings}
          </div>
          <div className="text-xs text-yellow-600">Need review</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-700">
            {exportResult.failedFiles}
          </div>
          <div className="text-xs text-red-600">Failed</div>
        </div>
      </div>

      {/* File list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <span className="font-medium text-gray-900">Files</span>
        </div>
        <ul className="divide-y divide-gray-200 max-h-64 overflow-auto">
          {exportResult.fileResults.map((file) => (
            <li
              key={file.fileId}
              className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center min-w-0">
                {getStatusIcon(file.status)}
                <span className="ml-3 text-sm text-gray-900 truncate">
                  {file.filename}
                </span>
              </div>
              <div className="ml-4 flex items-center">
                {file.reason && (
                  <span
                    className={`
                      text-xs px-2 py-0.5 rounded-full mr-2
                      ${
                        file.status === 'needs_review'
                          ? 'bg-yellow-100 text-yellow-700'
                          : file.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : ''
                      }
                    `}
                  >
                    {file.reason}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {getFileExportStatusLabel(file.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      {isComplete && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onDownload}
            className="
              px-6 py-3 rounded-lg font-medium
              bg-green-600 text-white hover:bg-green-700
              flex items-center justify-center
            "
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download ZIP (CSV)
          </button>

          {onExportAnother && (
            <button
              onClick={onExportAnother}
              className="
                px-6 py-3 rounded-lg font-medium
                border border-gray-300 text-gray-700 hover:bg-gray-50
              "
            >
              Export another group
            </button>
          )}
        </div>
      )}

      {/* Warning message if there are issues */}
      {isComplete && exportResult.filesWithWarnings > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-yellow-900">Some files need review</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {exportResult.filesWithWarnings} document(s) had slight layout differences.
                We exported them, but you should review the output to ensure accuracy.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportProgress;
