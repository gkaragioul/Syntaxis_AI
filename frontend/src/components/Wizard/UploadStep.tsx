import React, { useCallback, useState } from 'react';
import { useWizard } from '../../contexts/WizardContext';

export const UploadStep: React.FC = () => {
  const { selectedFiles, setSelectedFiles, uploadFiles, isLoading } = useWizard();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter(
        (file) => file.type === 'application/pdf'
      );
      if (files.length > 0) {
        setSelectedFiles([...selectedFiles, ...files]);
      }
    },
    [selectedFiles, setSelectedFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        const pdfFiles = Array.from(files).filter(
          (file) => file.type === 'application/pdf'
        );
        setSelectedFiles([...selectedFiles, ...pdfFiles]);
      }
      // Reset input
      e.target.value = '';
    },
    [selectedFiles, setSelectedFiles]
  );

  const removeFile = useCallback(
    (index: number) => {
      setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    },
    [selectedFiles, setSelectedFiles]
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Upload your documents</h1>
        <p className="mt-2 text-gray-600">
          Drag and drop PDF files or click to browse
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-12
          transition-colors duration-200 cursor-pointer
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
          }
        `}
      >
        <input
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center">
          {/* Upload icon */}
          <div
            className={`
              w-16 h-16 rounded-full flex items-center justify-center mb-4
              ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}
            `}
          >
            <svg
              className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <p className="text-lg font-medium text-gray-700">
            {isDragging ? 'Drop files here' : 'Drag PDFs here'}
          </p>
          <p className="mt-1 text-sm text-gray-500">or click to browse</p>
          <p className="mt-3 text-xs text-gray-400">
            Supports PDF files up to 100MB each
          </p>
        </div>
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedFiles([])}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            </div>
          </div>

          <ul className="divide-y divide-gray-200 max-h-64 overflow-auto">
            {selectedFiles.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center min-w-0">
                  {/* PDF icon */}
                  <div className="w-10 h-10 flex-shrink-0 rounded bg-red-50 flex items-center justify-center mr-3">
                    <svg
                      className="w-6 h-6 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>

                <button
                  onClick={() => removeFile(index)}
                  className="ml-4 p-1 text-gray-400 hover:text-red-500 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action button */}
      <div className="flex justify-center">
        <button
          onClick={uploadFiles}
          disabled={selectedFiles.length === 0 || isLoading}
          className={`
            px-8 py-3 rounded-lg font-medium text-lg
            transition-colors duration-200
            ${
              selectedFiles.length === 0 || isLoading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }
          `}
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
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
              Uploading...
            </span>
          ) : (
            `Next${selectedFiles.length > 0 ? ` (${selectedFiles.length} files)` : ''}`
          )}
        </button>
      </div>
    </div>
  );
};

export default UploadStep;
