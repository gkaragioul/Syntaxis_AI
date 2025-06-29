import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ErrorReport } from '../types/notifications';
import { api } from '../utils/api';
import { format } from 'date-fns';
import {
  ExclamationCircleIcon,
  DocumentArrowDownIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

export const ErrorReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ErrorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/notifications/error-reports/${id}`);
        setReport(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to load error report');
        console.error('Error fetching error report:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

  const handleDownload = async (format: 'pdf' | 'csv') => {
    if (!report) return;

    try {
      setDownloading(true);
      const response = await api.get(`/notifications/error-reports/${id}/download`, {
        params: { format },
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `error-report-${id}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Failed to download error report');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center">Loading error report...</div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center text-red-600">
            <ExclamationCircleIcon className="mx-auto h-12 w-12" />
            <h2 className="mt-2 text-lg font-medium">{error || 'Error report not found'}</h2>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Error Report</h1>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleDownload('pdf')}
                  disabled={downloading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                  Download PDF
                </button>
                <button
                  onClick={() => handleDownload('csv')}
                  disabled={downloading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                  Download CSV
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Error Type</dt>
                <dd className="mt-1 text-sm text-gray-900">{report.errorType}</dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Error Message</dt>
                <dd className="mt-1 text-sm text-gray-900">{report.errorMessage}</dd>
              </div>

              {report.errorDetails && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Error Details</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto">
                      {JSON.stringify(report.errorDetails, null, 2)}
                    </pre>
                  </dd>
                </div>
              )}

              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Troubleshooting Tips</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <ul className="list-disc pl-5 space-y-2">
                    {report.troubleshootingTips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </dd>
              </div>

              {report.stackTrace && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Stack Trace</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-xs">
                      {report.stackTrace}
                    </pre>
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500">Created At</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {format(new Date(report.createdAt), 'PPpp')}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">Download Count</dt>
                <dd className="mt-1 text-sm text-gray-900">{report.downloadCount}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}; 