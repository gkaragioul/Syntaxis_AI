import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/theme';

// Create a custom render function that includes providers
const customRender = (
  ui: ReactElement,
  {
    route = '/',
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0, // Updated from cacheTime
        },
      },
    }),
    ...renderOptions
  }: {
    route?: string;
    queryClient?: QueryClient;
  } & Omit<RenderOptions, 'wrapper'> = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );

  window.history.pushState({}, 'Test page', route);

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
};

// Re-export everything
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Mock API responses
export const mockApiResponse = <T>(data: T, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
};

// Mock API error
export const mockApiError = (status = 500, message = 'Internal Server Error') => {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
  });
};

// Mock file upload
export const createMockFile = (name: string, size: number, type: string) => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Mock PDF file
export const createMockPdfFile = (name = 'test.pdf', size = 1024) => {
  return createMockFile(name, size, 'application/pdf');
};

// Mock image file
export const createMockImageFile = (name = 'test.jpg', size = 1024) => {
  return createMockFile(name, size, 'image/jpeg');
};

// Mock form data
export const createMockFormData = (files: File[]) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  return formData;
};

// Mock user
export const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock invoice
export const mockInvoice = {
  id: '1',
  userId: '1',
  filename: 'test.pdf',
  status: 'processed',
  extractedData: {
    invoiceNumber: 'INV-001',
    date: '2024-02-20',
    total: 1000.00,
    currency: 'USD',
    vendor: 'Test Vendor',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock auth token
export const mockAuthToken = 'mock-jwt-token';

// Mock localStorage token
export const setAuthToken = (token: string = mockAuthToken) => {
  localStorage.setItem('auth_token', token);
};

// Clear auth token
export const clearAuthToken = () => {
  localStorage.removeItem('auth_token');
};

// Mock API delay
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)); 