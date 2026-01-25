// @ts-nocheck
import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { LocalFileUploadService, UploadProgress } from '../../services/localFileUploadService';
import { invoiceStorage } from '../../services/invoiceStorage';
import { ocrService } from '../../services/ocrService';
import { FileUploadProgress } from './FileUploadProgress';
import { FileUploadError } from './FileUploadError';
import { PDFPreview } from './PDFPreview';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { config } from '../../config';
import { ErrorHandler } from '../../utils/errorHandler';

interface FileUploaderProps {
    onUploadComplete?: (uploadId: string) => void;
    onUploadError?: (error: Error) => void;
    maxFiles?: number;
    maxSize?: number; // in bytes
    className?: string;
}

interface UploadState {
    uploadId: string | null;
    progress: number;
    status: 'idle' | 'uploading' | 'complete' | 'failed';
    error: string | null;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
    onUploadComplete,
    onUploadError,
    maxFiles = 100,
    maxSize = config.uploads.maxFileSize,
    className = '',
}) => {
    const [files, setFiles] = useState<File[]>([]);
    const [uploadState, setUploadState] = useState<UploadState>({
        uploadId: null,
        progress: 0,
        status: 'idle',
        error: null,
    });
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Upload mutation
    const uploadMutation = useMutation({
        mutationFn: async (filesToUpload: File[]) => {
            // Cancel any existing upload
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            // Upload each file and create invoice
            const uploadPromises = filesToUpload.map(async (file) => {
                try {
                    // Upload file
                    const fileId = await LocalFileUploadService.uploadFile(
                        file,
                        (progress: UploadProgress) => {
                            setUploadState((prev) => ({
                                ...prev,
                                progress: progress.progress,
                                status: progress.status,
                                error: progress.error || null,
                            }));
                        },
                        (error: Error) => {
                            setUploadState((prev) => ({
                                ...prev,
                                status: 'failed',
                                error: error.message,
                            }));
                            onUploadError?.(error);
                        }
                    );

                    // Create invoice record linked to file
                    let invoice = await invoiceStorage.create({
                        filename: file.name,
                        file: {
                            id: fileId,
                            originalFilename: file.name,
                        },
                        status: 'processing',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });

                    // Perform OCR to extract data
                    try {
                        setUploadState((prev) => ({
                            ...prev,
                            status: 'uploading',
                            error: null,
                        }));

                        const extractedData = await ocrService.processInvoice(file, (progress) => {
                            setUploadState((prev) => ({
                                ...prev,
                                progress: Math.min(95, 50 + progress * 0.45),
                            }));
                        });

                        // Update invoice with extracted data
                        invoice = await invoiceStorage.update(invoice.id, {
                            ...extractedData,
                            status: 'completed',
                            extractedData,
                            updatedAt: new Date().toISOString(),
                        });
                    } catch (ocrError) {
                        console.warn('OCR processing failed, marking as pending:', ocrError);
                        // Update invoice status to pending if OCR fails
                        invoice = await invoiceStorage.update(invoice.id, {
                            status: 'pending',
                            updatedAt: new Date().toISOString(),
                        });
                    }

                    return { fileId, invoiceId: invoice.id };
                } catch (error) {
                    if (error instanceof Error && error.name === 'AbortError') {
                        throw new Error('Upload cancelled');
                    }
                    throw error;
                }
            });

            const results = await Promise.all(uploadPromises);
            return results[0]; // Return first result
        },
        onSuccess: (result) => {
            setFiles([]);
            setUploadState({
                uploadId: result.invoiceId,
                progress: 100,
                status: 'complete',
                error: null,
            });
            onUploadComplete?.(result.invoiceId);
            toast.success('File uploaded and invoice created successfully');
        },
        onError: (error: Error) => {
            const appError = ErrorHandler.handle(error, 'FileUpload');
            setUploadState((prev) => ({
                ...prev,
                status: 'failed',
                error: appError.userMessage,
            }));
            onUploadError?.(error);
            toast.error(appError.userMessage);
            ErrorHandler.reportError(appError, 'FileUpload');
        },
        onSettled: () => {
            abortControllerRef.current = null;
        },
    });

    // Handle file drop
    const onDrop = useCallback((acceptedFiles: File[]) => {
        // Validate file count
        if (acceptedFiles.length > maxFiles) {
            const error = ErrorHandler.createError(
                'TOO_MANY_FILES',
                `${acceptedFiles.length} files provided, maximum is ${maxFiles}`,
                `Maximum ${maxFiles} files allowed`
            );
            setUploadState((prev) => ({
                ...prev,
                error: error.userMessage,
            }));
            return;
        }

        // Validate each file
        const validFiles: File[] = [];
        const errors: string[] = [];

        for (const file of acceptedFiles) {
            const validationError = ErrorHandler.validateFile(file, maxSize);
            if (validationError) {
                errors.push(validationError.userMessage);
            } else {
                validFiles.push(file);
            }
        }

        if (errors.length > 0) {
            setUploadState((prev) => ({
                ...prev,
                error: errors.join('; '),
            }));
            return;
        }

        setFiles(validFiles);
        setUploadState((prev) => ({ ...prev, error: null }));

        // Show preview for first file
        if (validFiles.length > 0) {
            setPreviewFile(validFiles[0]);
            setShowPreview(true);
        }
    }, [maxFiles, maxSize]);

    // Configure dropzone
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
        },
        maxFiles,
        maxSize,
    });

    // Handle upload
    const handleUpload = async () => {
        if (files.length === 0) {
            setUploadState((prev) => ({
                ...prev,
                error: 'Please select files to upload',
            }));
            return;
        }

        setUploadState({
            uploadId: null,
            progress: 0,
            status: 'uploading',
            error: null,
        });

        uploadMutation.mutate(files);
    };

    // Handle cancel
    const handleCancel = async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        // No need to cancel on server for local uploads
        setUploadState({
            uploadId: null,
            progress: 0,
            status: 'idle',
            error: null,
        });
        setFiles([]);
    };

    // Handle file removal
    const handleRemoveFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Dropzone */}
            <div
                {...getRootProps()}
                className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                    transition-colors duration-200
                    ${
                        isDragActive
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-blue-400'
                    }
                    ${uploadState.status === 'uploading' ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                <input {...getInputProps()} disabled={uploadState.status === 'uploading'} />
                <div className="space-y-2">
                    <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                    >
                        <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <div className="text-sm text-gray-600">
                        {isDragActive ? (
                            <p>Drop the files here ...</p>
                        ) : (
                            <p>
                                Drag and drop PDF files here, or click to select files
                                <br />
                                <span className="text-xs">
                                    (Maximum {maxFiles} files, {Math.round(maxSize / 1024 / 1024)}MB
                                    each)
                                </span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Error message */}
            {uploadState.error && (
                <FileUploadError
                    message={uploadState.error}
                    onDismiss={() =>
                        setUploadState((prev) => ({ ...prev, error: null }))
                    }
                />
            )}

            {/* File list */}
            {files.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">Selected files:</h3>
                    <ul className="space-y-2">
                        {files.map((file, index) => (
                            <li
                                key={`${file.name}-${index}`}
                                className="flex items-center justify-between bg-gray-50 rounded-lg p-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <svg
                                        className="h-5 w-5 text-gray-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                        />
                                    </svg>
                                    <span className="text-sm text-gray-600">{file.name}</span>
                                    <span className="text-xs text-gray-400">
                                        ({Math.round(file.size / 1024 / 1024)}MB)
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveFile(index)}
                                    className="text-red-500 hover:text-red-700"
                                    disabled={uploadState.status === 'uploading'}
                                >
                                    <svg
                                        className="h-5 w-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
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

            {/* Upload progress */}
            {uploadState.status === 'uploading' && (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Uploading...</span>
                        <span>{uploadState.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadState.progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end space-x-4">
                {uploadState.status === 'uploading' ? (
                    <Button
                        onClick={handleCancel}
                        variant="secondary"
                        className="flex items-center space-x-2"
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                        <span>Cancel</span>
                    </Button>
                ) : (
                    files.length > 0 && (
                        <Button
                            onClick={handleUpload}
                            disabled={uploadState.status === 'uploading'}
                            className="flex items-center space-x-2"
                        >
                            {uploadState.status === 'uploading' ? (
                                <>
                                    <Spinner className="h-4 w-4" />
                                    <span>Uploading...</span>
                                </>
                            ) : (
                                <span>
                                    Upload {files.length} file{files.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </Button>
                    )
                )}
            </div>

            {/* PDF Preview Modal */}
            {showPreview && previewFile && (
                <PDFPreview
                    file={previewFile}
                    onClose={() => {
                        setShowPreview(false);
                        // Proceed with upload after preview is closed
                        setTimeout(() => {
                            handleUpload();
                        }, 100);
                    }}
                />
            )}
        </div>
    );
};

export default FileUploader;