import { useState, useCallback, useEffect } from 'react';
import { invoiceStorage } from '../services/invoiceStorage';

export interface Invoice {
  id: string;
  filename?: string;
  invoiceNumber?: string;
  vendorName?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  subtotal?: number;
  taxAmount?: number;
  notes?: string;
  confidenceScore?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'processed';
  extractedData?: Record<string, any>;
  file?: {
    id: string;
    originalFilename: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InvoicesResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export interface UseInvoicesOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const useInvoices = (options: UseInvoicesOptions = {}) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    status = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await invoiceStorage.list({
        page,
        limit,
        search,
        status,
        sortBy,
        sortOrder,
      });
      setInvoices(response.invoices);
      setPagination({
        page: response.page,
        limit: response.limit,
        total: response.total,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, status, sortBy, sortOrder]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const uploadInvoice = useCallback(async (file: File) => {
    try {
      setIsLoading(true);
      setError(null);
      const newInvoice = await invoiceStorage.create({
        filename: file.name,
        status: 'pending',
      });
      setInvoices(prev => [newInvoice, ...prev]);
      return newInvoice;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload invoice');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteInvoice = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await invoiceStorage.delete(id);
      setInvoices(prev => prev.filter(inv => inv.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    invoices,
    isLoading,
    error,
    pagination,
    refetch,
    uploadInvoice,
    deleteInvoice,
  };
};

