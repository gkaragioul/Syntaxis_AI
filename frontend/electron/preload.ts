import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  isElectron: true,
  // Local invoice storage API
  invoices: {
    list: (options?: any) => ipcRenderer.invoke('invoices:list', options),
    create: (invoice: any) => ipcRenderer.invoke('invoices:create', invoice),
    get: (id: string) => ipcRenderer.invoke('invoices:get', id),
    update: (id: string, updates: any) => ipcRenderer.invoke('invoices:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('invoices:delete', id),
  },
  // Local file storage API
  files: {
    upload: (fileData: any) => ipcRenderer.invoke('files:upload', fileData),
    list: () => ipcRenderer.invoke('files:list'),
    delete: (fileId: string) => ipcRenderer.invoke('files:delete', fileId),
  },
});

export {};

