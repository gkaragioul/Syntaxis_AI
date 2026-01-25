import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useInvoices } from '../hooks/useInvoices';
import { DashboardLayout } from '../components/Dashboard/DashboardLayout';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ExportService } from '../services/exportService';
import { invoiceStorage } from '../services/invoiceStorage';
import { toast } from 'react-hot-toast';

export const InvoiceList: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    invoices,
    pagination,
    isLoading,
    error,
    refetch
  } = useInvoices({
    page,
    limit: 10,
    search,
    status,
    sortBy,
    sortOrder
  });

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, status, sortBy, sortOrder]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const handleExportCSV = () => {
    try {
      const filename = ExportService.generateFilename('invoices', 'csv');
      ExportService.exportToCSV(invoices, filename);
      toast.success('Invoices exported to CSV');
    } catch (error) {
      toast.error('Failed to export invoices');
      console.error(error);
    }
  };

  const handleExportPDF = () => {
    try {
      const filename = ExportService.generateFilename('invoices', 'pdf');
      ExportService.exportMultipleToPDF(invoices, filename);
      toast.success('Invoices exported to PDF');
    } catch (error) {
      toast.error('Failed to export invoices');
      console.error(error);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map(inv => inv.id)));
    }
  };

  const handleSelectInvoice = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('No invoices selected');
      return;
    }

    if (!window.confirm(`Delete ${selectedIds.size} invoice(s)? This cannot be undone.`)) {
      return;
    }

    try {
      let deleted = 0;
      for (const id of selectedIds) {
        try {
          await invoiceStorage.delete(id);
          deleted++;
        } catch (error) {
          console.error(`Failed to delete invoice ${id}:`, error);
        }
      }
      setSelectedIds(new Set());
      refetch();
      toast.success(`Deleted ${deleted} invoice(s)`);
    } catch (error) {
      toast.error('Failed to delete invoices');
      console.error(error);
    }
  };

  const handleBatchExportCSV = () => {
    if (selectedIds.size === 0) {
      toast.error('No invoices selected');
      return;
    }

    try {
      const selectedInvoices = invoices.filter(inv => selectedIds.has(inv.id));
      const filename = ExportService.generateFilename('invoices_batch', 'csv');
      ExportService.exportToCSV(selectedInvoices, filename);
      toast.success(`Exported ${selectedInvoices.length} invoice(s) to CSV`);
    } catch (error) {
      toast.error('Failed to export invoices');
      console.error(error);
    }
  };

  const handleBatchExportPDF = () => {
    if (selectedIds.size === 0) {
      toast.error('No invoices selected');
      return;
    }

    try {
      const selectedInvoices = invoices.filter(inv => selectedIds.has(inv.id));
      const filename = ExportService.generateFilename('invoices_batch', 'pdf');
      ExportService.exportMultipleToPDF(selectedInvoices, filename);
      toast.success(`Exported ${selectedInvoices.length} invoice(s) to PDF`);
    } catch (error) {
      toast.error('Failed to export invoices');
      console.error(error);
    }
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800">Failed to load invoices</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button
            onClick={refetch}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-white shadow rounded-lg">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 sm:flex sm:items-center sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="relative rounded-md shadow-sm">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoices..."
                className="block w-full pr-10 sm:text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-4">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="">All Status</option>
              <option value="processed">Processed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-4 flex gap-2 flex-wrap">
            {invoices.length > 0 && (
              <>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  Export CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                >
                  Export PDF
                </button>
              </>
            )}
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={handleBatchExportCSV}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  Export Selected CSV ({selectedIds.size})
                </button>
                <button
                  onClick={handleBatchExportPDF}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  Export Selected PDF ({selectedIds.size})
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 text-sm font-medium"
                >
                  Delete Selected ({selectedIds.size})
                </button>
              </>
            )}
            <Link to="/upload">
              <Button>
                Upload Invoice
              </Button>
            </Link>
          </div>
        </div>

        {/* Invoice list */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === invoices.length && invoices.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('invoiceNumber')}
                >
                  Invoice Number {renderSortIcon('invoiceNumber')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('vendorName')}
                >
                  Vendor {renderSortIcon('vendorName')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('invoiceDate')}
                >
                  Date {renderSortIcon('invoiceDate')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('dueDate')}
                >
                  Due Date {renderSortIcon('dueDate')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('totalAmount')}
                >
                  Amount {renderSortIcon('totalAmount')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('status')}
                >
                  Status {renderSortIcon('status')}
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center">
                    <Spinner size={32} />
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice: any) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(invoice.id)}
                        onChange={() => handleSelectInvoice(invoice.id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.vendorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invoice.invoiceDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          invoice.status === 'processed'
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'processing'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/invoices/${invoice.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && Math.ceil(pagination.total / pagination.limit) > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <Button
                variant="outlined"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outlined"
                onClick={() => setPage(page + 1)}
                disabled={page === Math.ceil(pagination.total / pagination.limit)}
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {(page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">{pagination.total}</span>{' '}
                  results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  {(() => {
                    const totalPages = Math.ceil(pagination.total / pagination.limit);
                    return (
                      <>
                        <Button
                          variant="outlined"
                          onClick={() => setPage(page - 1)}
                          disabled={page === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          Previous
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                          (pageNum) => (
                            <Button
                              key={pageNum}
                              variant={pageNum === page ? 'contained' : 'outlined'}
                              onClick={() => setPage(pageNum)}
                              className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              {pageNum}
                            </Button>
                          )
                        )}
                        <Button
                          variant="outlined"
                          onClick={() => setPage(page + 1)}
                          disabled={page === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          Next
                        </Button>
                      </>
                    );
                  })()}
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}; 