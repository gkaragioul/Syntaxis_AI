/**
 * Invoice Storage Service
 * Provides a unified interface for invoice storage that works both in Electron (local)
 * and web (API) environments.
 */

import { api } from './api';
import { InvoiceType } from './invoiceTypeDetector';

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
  // Sprint 1 additions
  invoiceType?: InvoiceType;
  validationErrors?: string[];
  fieldConfidence?: Record<string, number>; // 0..1 per field
}

export interface InvoicesResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Check if we're in Electron environment
const isElectron = (): boolean => {
  try {
    return !!(typeof window !== 'undefined' && (window as any).electron?.isElectron);
  } catch {
    return false;
  }
};

// Get the Electron API
const getElectronAPI = () => {
  return (window as any).electron;
};

export const invoiceStorage = {
  /**
   * List invoices with pagination and filtering
   */
  async list(options: ListOptions = {}): Promise<InvoicesResponse> {
    if (isElectron()) {
      try {
        const electronAPI = getElectronAPI();
        return await electronAPI.invoices.list(options);
      } catch (error) {
        console.error('Error listing invoices from Electron:', error);
        throw error;
      }
    }

    // Fallback to API
    try {
      const response = await api.get<InvoicesResponse>('/invoices', { params: options });
      return response.data;
    } catch (error) {
      console.error('Error listing invoices from API:', error);
      throw error;
    }
  },

  /**
   * Create a new invoice
   */
  async create(invoice: Partial<Invoice>): Promise<Invoice> {
    if (isElectron()) {
      try {
        const electronAPI = getElectronAPI();
        return await electronAPI.invoices.create(invoice);
      } catch (error) {
        console.error('Error creating invoice in Electron:', error);
        throw error;
      }
    }

    // Fallback to API
    try {
      const response = await api.post<Invoice>('/invoices', invoice);
      return response.data;
    } catch (error) {
      console.error('Error creating invoice via API:', error);
      throw error;
    }
  },

  /**
   * Get a single invoice by ID
   */
  async get(id: string): Promise<Invoice | null> {
    if (isElectron()) {
      try {
        const electronAPI = getElectronAPI();
        return await electronAPI.invoices.get(id);
      } catch (error) {
        console.error('Error getting invoice from Electron:', error);
        throw error;
      }
    }

    // Fallback to API
    try {
      const response = await api.get<Invoice>(`/invoices/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error getting invoice from API:', error);
      throw error;
    }
  },

  /**
   * Update an invoice
   */
  async update(id: string, updates: Partial<Invoice>): Promise<Invoice> {
    if (isElectron()) {
      try {
        const electronAPI = getElectronAPI();
        return await electronAPI.invoices.update(id, updates);
      } catch (error) {
        console.error('Error updating invoice in Electron:', error);
        throw error;
      }
    }

    // Fallback to API
    try {
      const response = await api.patch<Invoice>(`/invoices/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating invoice via API:', error);
      throw error;
    }
  },

  /**
   * Delete an invoice
   */
  async delete(id: string): Promise<boolean> {
    if (isElectron()) {
      try {
        const electronAPI = getElectronAPI();
        return await electronAPI.invoices.delete(id);
      } catch (error) {
        console.error('Error deleting invoice in Electron:', error);
        throw error;
      }
    }

    // Fallback to API
    try {
      await api.delete(`/invoices/${id}`);
      return true;
    } catch (error) {
      console.error('Error deleting invoice via API:', error);
      throw error;
    }
  },
};

export default invoiceStorage;

