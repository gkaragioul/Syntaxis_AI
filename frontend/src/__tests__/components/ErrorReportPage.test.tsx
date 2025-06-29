import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorReportPage } from '../../components/ErrorReportPage';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

// Mock react-router-dom hooks
jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  useNavigate: jest.fn(),
}));

// Mock api service
jest.mock('../../services/api');

describe('ErrorReportPage', () => {
  const mockErrorReport = {
    id: 'report123',
    userId: 'user123',
    batchJobId: 'job123',
    errorType: 'EXTRACTION_ERROR',
    errorCode: 'E001',
    errorMessage: 'Failed to extract PDF',
    errorDetails: {
      page: 1,
      file: 'test.pdf',
      line: 42,
    },
    troubleshootingTips: [
      'Check if the PDF file is not corrupted',
      'Verify that the file has proper permissions',
    ],
    stackTrace: 'Error: PDF extraction failed\n    at extractPDF (extractor.js:42:10)',
    downloadCount: 2,
    createdAt: '2024-03-20T10:00:00Z',
    updatedAt: '2024-03-20T10:05:00Z',
  };

  const mockNavigate = jest.fn();

  beforeEach(() => {
    (useParams as jest.Mock).mockReturnValue({ id: 'report123' });
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (api.getErrorReport as jest.Mock).mockResolvedValue(mockErrorReport);
    (api.downloadErrorReport as jest.Mock).mockResolvedValue({
      data: new Blob(['mock content'], { type: 'application/pdf' }),
      filename: 'error-report-report123.pdf',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders error report details', async () => {
    render(<ErrorReportPage />);

    // Wait for the report to load
    await waitFor(() => {
      expect(screen.getByText('Error Report Details')).toBeInTheDocument();
    });

    // Check if all report details are displayed
    expect(screen.getByText('Error Type: EXTRACTION_ERROR')).toBeInTheDocument();
    expect(screen.getByText('Error Code: E001')).toBeInTheDocument();
    expect(screen.getByText('Error Message: Failed to extract PDF')).toBeInTheDocument();
    expect(screen.getByText('Page: 1')).toBeInTheDocument();
    expect(screen.getByText('File: test.pdf')).toBeInTheDocument();
    expect(screen.getByText('Line: 42')).toBeInTheDocument();
    expect(screen.getByText('Download Count: 2')).toBeInTheDocument();
    expect(screen.getByText('Created: March 20, 2024, 10:00 AM')).toBeInTheDocument();
    expect(screen.getByText('Last Updated: March 20, 2024, 10:05 AM')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    (api.getErrorReport as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<ErrorReportPage />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows error state', async () => {
    (api.getErrorReport as jest.Mock).mockRejectedValue(new Error('Failed to fetch error report'));

    render(<ErrorReportPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch error report')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('retries fetching error report on error', async () => {
    (api.getErrorReport as jest.Mock)
      .mockRejectedValueOnce(new Error('Failed to fetch error report'))
      .mockResolvedValueOnce(mockErrorReport);

    render(<ErrorReportPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch error report')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Error Report Details')).toBeInTheDocument();
    });
  });

  it('downloads error report in PDF format', async () => {
    render(<ErrorReportPage />);

    await waitFor(() => {
      expect(screen.getByText('Error Report Details')).toBeInTheDocument();
    });

    const downloadButton = screen.getByText('Download PDF');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(api.downloadErrorReport).toHaveBeenCalledWith('report123', 'pdf');
    });
  });

  it('downloads error report in CSV format', async () => {
    render(<ErrorReportPage />);

    await waitFor(() => {
      expect(screen.getByText('Error Report Details')).toBeInTheDocument();
    });

    const downloadButton = screen.getByText('Download CSV');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(api.downloadErrorReport).toHaveBeenCalledWith('report123', 'csv');
    });
  });

  it('handles download errors', async () => {
    (api.downloadErrorReport as jest.Mock).mockRejectedValue(new Error('Download failed'));

    render(<ErrorReportPage />);

    await waitFor(() => {
      expect(screen.getByText('Error Report Details')).toBeInTheDocument();
    });

    const downloadButton = screen.getByText('Download PDF');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to download error report')).toBeInTheDocument();
    });
  });

  it('displays troubleshooting tips', async () => {
    render(<ErrorReportPage />);

    await waitFor(() => {
      expect(screen.getByText('Troubleshooting Tips')).toBeInTheDocument();
    });

    expect(screen.getByText('Check if the PDF file is not corrupted')).toBeInTheDocument();
    expect(screen.getByText('Verify that the file has proper permissions')).toBeInTheDocument();
  });

  it('displays stack trace in a code block', async () => {
    render(<ErrorReportPage />);

    await waitFor(() => {
      expect(screen.getByText('Stack Trace')).toBeInTheDocument();
    });

    const stackTrace = screen.getByTestId('stack-trace');
    expect(stackTrace).toHaveTextContent('Error: PDF extraction failed');
    expect(stackTrace).toHaveTextContent('at extractPDF (extractor.js:42:10)');
  });

  it('navigates back to notifications', async () => {
    render(<ErrorReportPage />);

    await waitFor(() => {
      expect(screen.getByText('Error Report Details')).toBeInTheDocument();
    });

    const backButton = screen.getByText('Back to Notifications');
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/notifications');
  });

  it('handles missing error report ID', () => {
    (useParams as jest.Mock).mockReturnValue({ id: undefined });

    render(<ErrorReportPage />);

    expect(mockNavigate).toHaveBeenCalledWith('/notifications');
  });

  it('formats dates correctly', async () => {
    render(<ErrorReportPage />);

    await waitFor(() => {
      expect(screen.getByText('Error Report Details')).toBeInTheDocument();
    });

    expect(screen.getByText('Created: March 20, 2024, 10:00 AM')).toBeInTheDocument();
    expect(screen.getByText('Last Updated: March 20, 2024, 10:05 AM')).toBeInTheDocument();
  });

  it('displays error details in a structured format', async () => {
    render(<ErrorReportPage />);

    await waitFor(() => {
      expect(screen.getByText('Error Report Details')).toBeInTheDocument();
    });

    const errorDetails = screen.getByTestId('error-details');
    expect(errorDetails).toHaveTextContent('Page: 1');
    expect(errorDetails).toHaveTextContent('File: test.pdf');
    expect(errorDetails).toHaveTextContent('Line: 42');
  });
}); 