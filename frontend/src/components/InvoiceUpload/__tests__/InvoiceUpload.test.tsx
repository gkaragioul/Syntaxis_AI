import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '@/test/utils';
import { InvoiceUpload } from '../InvoiceUpload';
import { createMockPdfFile, mockApiResponse, mockApiError } from '@/test/utils';

describe('InvoiceUpload Component', () => {
  const mockOnUploadSuccess = vi.fn();
  const mockOnUploadError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders upload area correctly', () => {
    render(
      <InvoiceUpload
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to select files/i)).toBeInTheDocument();
    expect(screen.getByText(/supported formats: pdf/i)).toBeInTheDocument();
  });

  it('handles file selection via click', async () => {
    const file = createMockPdfFile();
    global.fetch = vi.fn().mockImplementation(() =>
      mockApiResponse({ id: '1', status: 'processing' })
    );

    render(
      <InvoiceUpload
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    const input = screen.getByTestId('file-input');
    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith({
        id: '1',
        status: 'processing',
      });
    });
  });

  it('handles drag and drop', async () => {
    const file = createMockPdfFile();
    global.fetch = vi.fn().mockImplementation(() =>
      mockApiResponse({ id: '1', status: 'processing' })
    );

    render(
      <InvoiceUpload
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    const dropzone = screen.getByTestId('dropzone');

    fireEvent.dragEnter(dropzone);
    expect(dropzone).toHaveClass('drag-active');

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith({
        id: '1',
        status: 'processing',
      });
    });
  });

  it('handles upload error', async () => {
    const file = createMockPdfFile();
    global.fetch = vi.fn().mockImplementation(() =>
      mockApiError(400, 'Invalid file format')
    );

    render(
      <InvoiceUpload
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    const input = screen.getByTestId('file-input');
    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnUploadError).toHaveBeenCalledWith('Invalid file format');
    });
  });

  it('validates file type', async () => {
    const file = createMockFile('test.txt', 1024, 'text/plain');

    render(
      <InvoiceUpload
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    const input = screen.getByTestId('file-input');
    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnUploadError).toHaveBeenCalledWith(
        'Only PDF files are supported'
      );
    });
  });

  it('validates file size', async () => {
    const file = createMockPdfFile('large.pdf', 1024 * 1024 * 11); // 11MB

    render(
      <InvoiceUpload
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
        maxSize={10 * 1024 * 1024} // 10MB
      />
    );

    const input = screen.getByTestId('file-input');
    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnUploadError).toHaveBeenCalledWith(
        'File size must be less than 10MB'
      );
    });
  });

  it('shows upload progress', async () => {
    const file = createMockPdfFile();
    let uploadProgress = 0;

    global.fetch = vi.fn().mockImplementation(() => {
      uploadProgress += 25;
      return mockApiResponse(
        { id: '1', status: 'processing' },
        uploadProgress === 100 ? 200 : 202
      );
    });

    render(
      <InvoiceUpload
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    const input = screen.getByTestId('file-input');
    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });
  });
}); 