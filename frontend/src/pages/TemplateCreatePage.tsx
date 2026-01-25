import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/Dashboard/DashboardLayout';
import toast from 'react-hot-toast';

interface DocumentInfo {
  id: number;
  filename: string;
  page_count: number;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const TemplateCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromDocId = searchParams.get('fromDocId');
  const batchId = searchParams.get('batchId');

  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [reportType, setReportType] = useState('');

  // Default schema for MVP
  const defaultSchema = {
    version: "1.0",
    anchors: [],
    tables: [{
      id: "table1",
      pages: "all",
      region: {
        mode: "absolute",
        bbox: { x0: 0, y0: 0, x1: 612, y1: 792 }
      },
      header: {
        depthRows: 1,
        repeatEachPage: false
      },
      columns: {
        mode: "auto",
        guides: null
      },
      cleanup: {
        dropEmptyRows: true,
        dropTotalsRows: false
      },
      mergedCells: {},
      output: {
        sheetName: "Sheet1",
        normalizeNumbers: true,
        keepCurrencySymbols: false
      }
    }],
    driftDetection: {
      maxAnchorDistancePx: 50,
      failOnDrift: false
    }
  };

  useEffect(() => {
    if (fromDocId) {
      fetchDocument(parseInt(fromDocId));
    } else {
      setLoading(false);
    }
  }, [fromDocId]);

  const fetchDocument = async (docId: number) => {
    try {
      const response = await fetch(`${API_BASE}/documents/${docId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDocument(data);
        // Pre-fill name from filename
        const baseName = data.filename.replace('.pdf', '').replace(/_/g, ' ');
        setName(`Template - ${baseName}`);
      } else {
        toast.error('Failed to load document');
      }
    } catch (error) {
      console.error('Error loading document', error);
      toast.error('Error loading document');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }

    setSaving(true);
    const loadingId = toast.loading('Creating template...');

    try {
      const response = await fetch(`${API_BASE}/templates/with-fingerprint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          schema_json: defaultSchema,
          sample_document_id: fromDocId ? parseInt(fromDocId) : null,
          vendor_name: vendorName.trim() || null,
          report_type: reportType.trim() || null
        })
      });

      if (response.ok) {
        await response.json();
        toast.success('Template created successfully!', { id: loadingId });

        // If we came from a batch, go back and re-match
        if (batchId) {
          // Trigger re-match
          await fetch(`${API_BASE}/batches/${batchId}/rematch`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          });
          navigate(`/batch/${batchId}`);
        } else {
          navigate('/templates');
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create template', { id: loadingId });
      }
    } catch (error) {
      console.error('Error creating template', error);
      toast.error('Error creating template', { id: loadingId });
    } finally {
      setSaving(false);
    }
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

  return (
    <DashboardLayout>
      <div className="py-6 max-w-3xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Create Template</h1>
          <p className="text-gray-600 mt-1">
            Create a new template for document extraction
          </p>
        </div>

        {document && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <h3 className="font-semibold text-blue-900">Sample Document</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Template fingerprint will be generated from: <strong>{document.filename}</strong> ({document.page_count} pages)
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Vendor X - Balance Sheet"
              required
            />
          </div>

          <div>
            <label htmlFor="vendorName" className="block text-sm font-medium text-gray-700 mb-1">
              Vendor Name
            </label>
            <input
              type="text"
              id="vendorName"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Acme Corporation"
            />
            <p className="text-xs text-gray-500 mt-1">Optional tag to identify the source vendor</p>
          </div>

          <div>
            <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 mb-1">
              Report Type
            </label>
            <select
              id="reportType"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select type...</option>
              <option value="balance_sheet">Balance Sheet</option>
              <option value="income_statement">Income Statement</option>
              <option value="invoice">Invoice</option>
              <option value="receipt">Receipt</option>
              <option value="purchase_order">Purchase Order</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Optional notes about this template..."
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Template Settings (MVP Defaults)</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>Region: Full page extraction (absolute mode)</li>
              <li>Headers: 1 row header depth</li>
              <li>Columns: Auto-detection mode</li>
              <li>Cleanup: Drop empty rows enabled</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">
              Advanced settings can be configured after creation in the Template Builder.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => batchId ? navigate(`/batch/${batchId}`) : navigate('/templates')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default TemplateCreatePage;
