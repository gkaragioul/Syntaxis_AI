import React, { useEffect, useRef } from 'react';
import { useWizard } from '../../contexts/WizardContext';
import { GroupCard } from './GroupCard';

export const GroupingStep: React.FC = () => {
  const {
    session,
    groups,
    isLoading,
    fetchGroups,
    selectGroup,
    exportGroup,
    exportResults,
  } = useWizard();

  // Track if we've already fetched to prevent infinite loops
  const hasFetchedRef = useRef(false);

  // Fetch groups when component mounts if we have a session
  useEffect(() => {
    if (session?.batchJobId && groups.length === 0 && !hasFetchedRef.current && !isLoading) {
      hasFetchedRef.current = true;
      fetchGroups();
    }
  }, [session?.batchJobId, groups.length, isLoading]);

  // Reset the ref when session changes (new session)
  useEffect(() => {
    hasFetchedRef.current = false;
  }, [session?.id]);

  // Show loading state while grouping
  if (isLoading && groups.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-6">
          <svg
            className="w-8 h-8 text-blue-600 animate-spin"
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
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Grouping similar documents...
        </h2>
        <p className="text-gray-600">
          We're analyzing your files to organize them by type.
        </p>
      </div>
    );
  }

  // Group statistics
  const readyGroups = groups.filter((g) => g.status === 'ready');
  const needsSetupGroups = groups.filter((g) => g.status === 'needs_setup');
  const notSupportedGroups = groups.filter((g) => g.status === 'not_supported');
  const totalFiles = groups.reduce((sum, g) => sum + g.fileCount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Your document groups</h1>
        <p className="mt-2 text-gray-600">
          We found {groups.length} group{groups.length !== 1 ? 's' : ''} in {totalFiles} documents
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{readyGroups.length}</div>
          <div className="text-sm text-green-600">Ready to export</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-700">{needsSetupGroups.length}</div>
          <div className="text-sm text-yellow-600">Need setup</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-500">{notSupportedGroups.length}</div>
          <div className="text-sm text-gray-500">Not supported</div>
        </div>
      </div>

      {/* Group cards */}
      <div className="space-y-4">
        {/* Ready groups first */}
        {readyGroups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            onExport={() => exportGroup(group.id)}
            isExporting={exportResults[group.id]?.status === 'running'}
          />
        ))}

        {/* Then needs setup */}
        {needsSetupGroups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            onSetup={() => selectGroup(group.id)}
          />
        ))}

        {/* Finally not supported */}
        {notSupportedGroups.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
      </div>

      {/* Help text */}
      {needsSetupGroups.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900">
                New document types detected
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Some of your documents look like a new type we haven't seen before.
                Click "Set up once" to teach the system how to extract data from them.
                After setup, all similar documents will be processed automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {groups.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
          <p className="mt-1 text-sm text-gray-500">
            Upload some PDF files to get started.
          </p>
        </div>
      )}
    </div>
  );
};

export default GroupingStep;
