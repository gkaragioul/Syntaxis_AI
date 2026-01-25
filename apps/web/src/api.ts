import axios from 'axios';

const API_BASE_URL = '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
  
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
};

export const documentAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  get: (documentId: number) =>
    api.get(`/documents/${documentId}`),
  
  detectTables: (documentId: number) =>
    api.get(`/documents/${documentId}/detect-tables`),

  downloadRaw: (documentId: number) =>
    api.get(`/documents/${documentId}/render`, { responseType: 'blob' }),
};

export const templateAPI = {
  create: (name: string, description: string, schema_json: any) =>
    api.post('/templates', { name, description, schema_json }),
  
  list: () =>
    api.get('/templates'),
  
  get: (templateId: number) =>
    api.get(`/templates/${templateId}`),
  
  update: (templateId: number, data: any) =>
    api.put(`/templates/${templateId}`, data),
};

export const previewAPI = {
  preview: (documentId: number, templateSchema: any) =>
    api.post('/preview', {
      document_id: documentId,
      template_schema_json: templateSchema,
    }),
};

export const batchAPI = {
  create: (templateId: number, documentIds: number[]) =>
    api.post('/batch', {
      template_id: templateId,
      document_ids: documentIds,
    }),
  
  getStatus: (batchId: number) =>
    api.get(`/batch/${batchId}/status`),
  
  download: (batchId: number) =>
    api.get(`/batch/${batchId}/download`, { responseType: 'blob' }),
};
