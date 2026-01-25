import React, { useMemo } from 'react';
import { useWizard } from '../../contexts/WizardContext';
import { ExportProgress } from './ExportProgress';
import { GroupCard } from './GroupCard';

export const ExportStep: React.FC = () => {
  const {
    groups,
    exportResults,
    exportGroup,
    downloadExport,
    selectGroup,
    goToStep,
  } = useWizard();

  // Find groups that have export results
  const exportedGroupIds = Object.keys(exportResults);
  const latestExportGroupId = exportedGroupIds[exportedGroupIds.length - 1];
  const latestExportResult = latestExportGroupId
    ? exportResults[latestExportGroupId]
    : null;

  const latestExportGroup = useMemo(
    () => groups.find((g) => g.id === latestExportGroupId),
    [groups, latestExportGroupId]
  );

  // Groups that can still be exported
  const readyGroups = groups.filter(
    (g) => g.status === 'ready' && !exportedGroupIds.includes(g.id)
  );

  // If we have an export in progress or completed, show progress
  if (latestExportResult && latestExportGroup) {
    return (
      <div className="space-y-8">
        <ExportProgress
          groupName={latestExportGroup.name}
          exportResult={latestExportResult}
          onDownload={() => downloadExport(latestExportGroupId)}
          onExportAnother={
            readyGroups.length > 0 ? () => goToStep(2) : undefined
          }
        />

        {/* Previously exported groups */}
        {exportedGroupIds.length > 1 && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Previous exports
            </h3>
            <div className="space-y-3">
              {exportedGroupIds.slice(0, -1).map((groupId) => {
                const group = groups.find((g) => g.id === groupId);
                const result = exportResults[groupId];
                if (!group || !result) return null;

                return (
                  <div
                    key={groupId}
                    className="flex items-center justify-between bg-gray-50 rounded-lg p-4"
                  >
                    <div className="flex items-center">
                      <span className="text-green-500 mr-3">
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                      <div>
                        <span className="font-medium text-gray-900">
                          {group.name}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          {result.exportedFiles} files
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadExport(groupId)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Download
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // If no exports yet, show groups ready to export
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Export your documents</h1>
        <p className="mt-2 text-gray-600">
          Choose a group to export to CSV
        </p>
      </div>

      {readyGroups.length > 0 ? (
        <div className="space-y-4">
          {readyGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onExport={() => exportGroup(group.id)}
              isExporting={exportResults[group.id]?.status === 'running'}
            />
          ))}
        </div>
      ) : (
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No groups ready for export
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Set up your document groups first, then come back to export.
          </p>
          <button
            onClick={() => goToStep(2)}
            className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
          >
            Go to Groups
          </button>
        </div>
      )}

      {/* Groups that need setup */}
      {groups.filter((g) => g.status === 'needs_setup').length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Groups needing setup
          </h3>
          <div className="space-y-3">
            {groups
              .filter((g) => g.status === 'needs_setup')
              .map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                >
                  <div className="flex items-center">
                    <span className="text-yellow-500 mr-3">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <div>
                      <span className="font-medium text-gray-900">
                        {group.name}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        {group.fileCount} documents
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => selectGroup(group.id)}
                    className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
                  >
                    Set up
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportStep;
