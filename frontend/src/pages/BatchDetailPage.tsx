import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/Dashboard/DashboardLayout';
import toast from 'react-hot-toast';

interface DocumentBucketItem {
  document_id: number;
  filename: string;
  match_status: string;
  confidence?: number;
  reasons?: string[];
}

interface TemplateBucket {
  template_id: number;
  template_name: string;
  vendor_name?: string;
  file_count: number;
  documents: DocumentBucketItem[];
}

interface BatchBucketSummary {
  batch_id: number;
  status: string;
  created_at: string;
  finished_at?: string;
  total_files: number;
  matched_count: number;
  unassigned_count: number;
  scanned_count: number;
  error_count: number;
  template_buckets: TemplateBucket[];
  unassigned_bucket: DocumentBucketItem[];
  scanned_bucket: DocumentBucketItem[];
  error_bucket: DocumentBucketItem[];
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const BatchDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<BatchBucketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());

  const fetchBatch = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/batches/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data: BatchBucketSummary = await response.json();
        setBatch(data);
      } else {
        toast.error('Failed to load batch details');
      }
    } catch (error) {
      console.error('Failed to fetch batch', error);
      toast.error('Network error loading batch');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchBatch();
  }, [id, fetchBatch]);

  // Poll for updates while processing
  useEffect(() => {
    if (batch?.status === 'RUNNING') {
      const interval = setInterval(fetchBatch, 3000);
      return () => clearInterval(interval);
    }
  }, [batch?.status, fetchBatch]);

  const handleProcessExtraction = async (templateId?: number) => {
    if (!id) return;
    setProcessing(true);
    const loadingId = toast.loading('Starting extraction...');

    try {
      const url = templateId
        ? `${API_BASE}/batches/${id}/run?template_id=${templateId}`
        : `${API_BASE}/batches/${id}/run`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message, { id: loadingId });
        fetchBatch();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to start extraction', { id: loadingId });
      }
    } catch (error) {
      console.error('Extraction trigger failed', error);
      toast.error('Error triggering extraction', { id: loadingId });
    } finally {
      setProcessing(false);
    }
  };

  const handleRematch = async () => {
    if (!id) return;
    setRematching(true);
    const loadingId = toast.loading('Re-matching documents...');

    try {
      const response = await fetch(`${API_BASE}/batches/${id}/rematch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message, { id: loadingId });
        fetchBatch();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to re-match', { id: loadingId });
      }
    } catch (error) {
      console.error('Rematch failed', error);
      toast.error('Error re-matching documents', { id: loadingId });
    } finally {
      setRematching(false);
    }
  };

  const handleDownload = async () => {
    if (!id || !batch) return;

    try {
      const response = await fetch(`${API_BASE}/batches/${id}/download`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch_${id}_results.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('Download started');
      } else {
        toast.error('Download not available yet');
      }
    } catch (error) {
      console.error('Download failed', error);
      toast.error('Error downloading results');
    }
  };

  const handleCreateTemplate = (docId: number) => {
    navigate(`/templates/new?fromDocId=${docId}&batchId=${id}`);
  };

  const toggleBucket = (bucketId: string) => {
    setExpandedBuckets(prev => {
      const next = new Set(prev);
      if (next.has(bucketId)) {
        next.delete(bucketId);
      } else {
        next.add(bucketId);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      QUEUED: 'bg-yellow-100 text-yellow-800',
      RUNNING: 'bg-blue-100 text-blue-800',
      DONE: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!batch) {
    return (
      <DashboardLayout>
        <div className="py-6 max-w-7xl mx-auto px-4">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900">Batch not found</h2>
            <button
              onClick={() => navigate('/inbox')}
              className="mt-4 text-blue-600 hover:underline"
            >
              Back to Inbox
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="py-6 max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">Batch #{batch.batch_id}</h1>
              {getStatusBadge(batch.status)}
            </div>
            <p className="text-gray-600 mt-1">
              {batch.total_files} files uploaded on {new Date(batch.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            {batch.status === 'DONE' && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Results
              </button>
            )}
            <button
              onClick={() => navigate('/inbox')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Inbox
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{batch.total_files}</div>
            <div className="text-sm text-gray-500">Total Files</div>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <div className="text-2xl font-bold text-green-700">{batch.matched_count}</div>
            <div className="text-sm text-green-600">Matched</div>
          </div>
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <div className="text-2xl font-bold text-yellow-700">{batch.unassigned_count}</div>
            <div className="text-sm text-yellow-600">Unassigned</div>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-700">{batch.scanned_count + batch.error_count}</div>
            <div className="text-sm text-gray-500">Scanned/Error</div>
          </div>
        </div>

        {/* Buckets */}
        <div className="space-y-4">

          {/* Matched Template Buckets */}
          {batch.template_buckets.map((bucket) => (
            <div key={bucket.template_id} className="bg-green-50 border border-green-200 rounded-lg overflow-hidden">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-green-100"
                onClick={() => toggleBucket(`template-${bucket.template_id}`)}
              >
                <div className="flex items-center">
                  <svg className={`w-5 h-5 mr-2 transform transition-transform ${expandedBuckets.has(`template-${bucket.template_id}`) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div>
                    <h2 className="text-lg font-semibold text-green-900">
                      {bucket.vendor_name ? `${bucket.vendor_name} - ` : ''}{bucket.template_name}
                    </h2>
                    <span className="text-green-700 text-sm">{bucket.file_count} files matched</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProcessExtraction(bucket.template_id);
                  }}
                  disabled={processing || batch.status === 'RUNNING'}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {batch.status === 'RUNNING' ? 'Processing...' : 'Run Extraction'}
                </button>
              </div>
              {expandedBuckets.has(`template-${bucket.template_id}`) && (
                <div className="border-t border-green-200 bg-white divide-y divide-gray-100 max-h-60 overflow-auto">
                  {bucket.documents.map((doc) => (
                    <div key={doc.document_id} className="p-3 flex justify-between items-center">
                      <div>
                        <span className="text-gray-900">{doc.filename}</span>
                        {doc.reasons && doc.reasons.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {doc.reasons.join(', ')}
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-green-600 font-medium">
                        {doc.confidence}% confidence
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Unassigned Bucket */}
          {batch.unassigned_bucket.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-yellow-100"
                onClick={() => toggleBucket('unassigned')}
              >
                <div className="flex items-center">
                  <svg className={`w-5 h-5 mr-2 transform transition-transform ${expandedBuckets.has('unassigned') ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div>
                    <h2 className="text-lg font-semibold text-yellow-900">
                      Unassigned / Low Confidence
                    </h2>
                    <span className="text-yellow-700 text-sm">{batch.unassigned_bucket.length} files need review</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRematch();
                    }}
                    disabled={rematching}
                    className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {rematching ? 'Re-matching...' : 'Re-match All'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (batch.unassigned_bucket[0]) {
                        handleCreateTemplate(batch.unassigned_bucket[0].document_id);
                      }
                    }}
                    className="bg-white text-yellow-700 border border-yellow-300 px-4 py-2 rounded hover:bg-yellow-50"
                  >
                    Create Template
                  </button>
                </div>
              </div>
              {expandedBuckets.has('unassigned') && (
                <div className="border-t border-yellow-200 bg-white divide-y divide-gray-100 max-h-60 overflow-auto">
                  {batch.unassigned_bucket.map((doc) => (
                    <div key={doc.document_id} className="p-3 flex justify-between items-center">
                      <div>
                        <span className="text-gray-900">{doc.filename}</span>
                        {doc.reasons && doc.reasons.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {doc.reasons.join(', ')}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleCreateTemplate(doc.document_id)}
                        className="text-sm text-yellow-600 hover:text-yellow-800"
                      >
                        Create Template
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scanned Bucket */}
          {batch.scanned_bucket.length > 0 && (
            <div className="bg-gray-50 border border-gray-300 rounded-lg overflow-hidden">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100"
                onClick={() => toggleBucket('scanned')}
              >
                <div className="flex items-center">
                  <svg className={`w-5 h-5 mr-2 transform transition-transform ${expandedBuckets.has('scanned') ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-700">
                      Scanned / Image PDFs
                    </h2>
                    <span className="text-gray-500 text-sm">{batch.scanned_bucket.length} files (not supported in MVP)</span>
                  </div>
                </div>
              </div>
              {expandedBuckets.has('scanned') && (
                <div className="border-t border-gray-200 bg-white divide-y divide-gray-100 max-h-60 overflow-auto">
                  {batch.scanned_bucket.map((doc) => (
                    <div key={doc.document_id} className="p-3 flex justify-between items-center">
                      <span className="text-gray-900">{doc.filename}</span>
                      <span className="text-sm text-gray-500">Scanned PDF</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error Bucket */}
          {batch.error_bucket.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-red-100"
                onClick={() => toggleBucket('error')}
              >
                <div className="flex items-center">
                  <svg className={`w-5 h-5 mr-2 transform transition-transform ${expandedBuckets.has('error') ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div>
                    <h2 className="text-lg font-semibold text-red-900">
                      Errors
                    </h2>
                    <span className="text-red-700 text-sm">{batch.error_bucket.length} files with errors</span>
                  </div>
                </div>
              </div>
              {expandedBuckets.has('error') && (
                <div className="border-t border-red-200 bg-white divide-y divide-gray-100 max-h-60 overflow-auto">
                  {batch.error_bucket.map((doc) => (
                    <div key={doc.document_id} className="p-3">
                      <span className="text-gray-900">{doc.filename}</span>
                      {doc.reasons && doc.reasons.length > 0 && (
                        <div className="text-xs text-red-600 mt-1">
                          {doc.reasons.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {batch.template_buckets.length === 0 &&
           batch.unassigned_bucket.length === 0 &&
           batch.scanned_bucket.length === 0 &&
           batch.error_bucket.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No files found in this batch.
            </div>
          )}
        </div>

        {/* Action Bar for All Matched */}
        {batch.matched_count > 0 && batch.status !== 'RUNNING' && batch.status !== 'DONE' && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-blue-900">Ready to extract?</h3>
              <p className="text-sm text-blue-700">
                Run extraction on all {batch.matched_count} matched documents at once.
              </p>
            </div>
            <button
              onClick={() => handleProcessExtraction()}
              disabled={processing}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? 'Starting...' : 'Extract All Matched'}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BatchDetailPage;
