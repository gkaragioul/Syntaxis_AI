import React from 'react';
import { WizardGroup, getGroupStatusLabel } from '../../types/wizard';

interface GroupCardProps {
  group: WizardGroup;
  onExport?: () => void;
  onSetup?: () => void;
  isExporting?: boolean;
}

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  onExport,
  onSetup,
  isExporting,
}) => {
  const getStatusStyles = () => {
    switch (group.status) {
      case 'ready':
        return {
          border: 'border-green-200',
          bg: 'bg-green-50',
          iconBg: 'bg-green-100',
          iconColor: 'text-green-600',
          badge: 'bg-green-100 text-green-700',
        };
      case 'needs_setup':
        return {
          border: 'border-yellow-200',
          bg: 'bg-yellow-50',
          iconBg: 'bg-yellow-100',
          iconColor: 'text-yellow-600',
          badge: 'bg-yellow-100 text-yellow-700',
        };
      case 'not_supported':
        return {
          border: 'border-gray-200',
          bg: 'bg-gray-50',
          iconBg: 'bg-gray-100',
          iconColor: 'text-gray-400',
          badge: 'bg-gray-100 text-gray-500',
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <div
      className={`
        rounded-xl border-2 ${styles.border} ${styles.bg}
        p-6 transition-all duration-200
        ${group.status !== 'not_supported' ? 'hover:shadow-md' : 'opacity-75'}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          {/* Icon */}
          <div
            className={`
              w-12 h-12 rounded-lg ${styles.iconBg}
              flex items-center justify-center mr-4
            `}
          >
            {group.status === 'not_supported' ? (
              <svg
                className={`w-6 h-6 ${styles.iconColor}`}
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
            ) : (
              <svg
                className={`w-6 h-6 ${styles.iconColor}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            )}
          </div>

          {/* Title & count */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
            <p className="text-sm text-gray-600">
              {group.fileCount} document{group.fileCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles.badge}`}>
          {getGroupStatusLabel(group.status)}
        </span>
      </div>

      {/* Action button */}
      {group.status === 'ready' && (
        <button
          onClick={onExport}
          disabled={isExporting}
          className={`
            w-full py-3 px-4 rounded-lg font-medium
            transition-colors duration-200
            ${
              isExporting
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }
          `}
        >
          {isExporting ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Exporting...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              Export now
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </span>
          )}
        </button>
      )}

      {group.status === 'needs_setup' && (
        <button
          onClick={onSetup}
          className="
            w-full py-3 px-4 rounded-lg font-medium
            bg-yellow-500 text-white hover:bg-yellow-600
            transition-colors duration-200
          "
        >
          <span className="flex items-center justify-center">
            Set up once
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </span>
        </button>
      )}

      {group.status === 'not_supported' && (
        <div className="text-center py-3 px-4 rounded-lg bg-gray-100 text-gray-500 text-sm">
          These appear to be scanned documents. Text extraction is not available.
        </div>
      )}
    </div>
  );
};

export default GroupCard;
