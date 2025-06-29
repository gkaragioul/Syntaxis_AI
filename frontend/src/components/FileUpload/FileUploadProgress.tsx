import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileUploadService } from '../../services/FileUploadService';

interface FileUploadProgressProps {
    batchJobId?: string;
    className?: string;
}

export const FileUploadProgress: React.FC<FileUploadProgressProps> = ({
    batchJobId,
    className = '',
}) => {
    // Query batch job status
    const { data: batchJob, isLoading } = useQuery({
        queryKey: ['batchJob', batchJobId],
        queryFn: () => FileUploadService.getBatchJobStatus(batchJobId!),
        enabled: !!batchJobId,
        refetchInterval: (data) => {
            // Stop polling when complete or failed
            if (data?.status === 'completed' || data?.status === 'failed') {
                return false;
            }
            return 2000; // Poll every 2 seconds
        },
    });

    if (!batchJobId || isLoading) {
        return (
            <div className={`animate-pulse ${className}`}>
                <div className="h-2 bg-gray-200 rounded w-full"></div>
            </div>
        );
    }

    if (!batchJob) {
        return null;
    }

    const progress = batchJob.getProgress();
    const isComplete = batchJob.status === 'completed';
    const isFailed = batchJob.status === 'failed';

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Progress bar */}
            <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                            {batchJob.status}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-blue-600">
                            {progress}%
                        </span>
                    </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                    <div
                        style={{ width: `${progress}%` }}
                        className={`
                            shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center
                            transition-all duration-500
                            ${
                                isComplete
                                    ? 'bg-green-500'
                                    : isFailed
                                    ? 'bg-red-500'
                                    : 'bg-blue-500'
                            }
                        `}
                    ></div>
                </div>
            </div>

            {/* Status details */}
            <div className="text-sm text-gray-600">
                <p>
                    Processed {batchJob.processedFiles} of {batchJob.totalFiles} files
                    {batchJob.failedFiles > 0 && (
                        <span className="text-red-500 ml-2">
                            ({batchJob.failedFiles} failed)
                        </span>
                    )}
                </p>
            </div>

            {/* Error summary */}
            {isFailed && batchJob.errorSummary && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg">
                    <h4 className="text-sm font-medium text-red-800 mb-2">Error Summary:</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                        {Object.entries(batchJob.errorSummary).map(([fileId, error]) => (
                            <li key={fileId} className="flex items-start">
                                <svg
                                    className="h-5 w-5 text-red-400 mr-2 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <span>{error as string}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Success message */}
            {isComplete && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg
                                className="h-5 w-5 text-green-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-green-800">
                                All files processed successfully
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileUploadProgress; 