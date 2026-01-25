import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { Invoice } from './useInvoices';

export const useInvoice = (id?: string) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get<Invoice>(`/invoices/${id}`);
      setInvoice(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const updateInvoice = useCallback(async (data: Partial<Invoice>) => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.put<Invoice>(`/invoices/${id}`, data);
      setInvoice(response.data);
      return response.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const deleteInvoice = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      await api.delete(`/invoices/${id}`);
      setInvoice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  return {
    invoice,
    isLoading,
    error,
    refetch,
    updateInvoice,
    deleteInvoice,
  };
};

