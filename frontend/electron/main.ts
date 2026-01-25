import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { getBackendPath } from './utils';

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

let backendProcess: ChildProcess | null = null;
let backendReady = false;
const BACKEND_PORT = 3001;
const BACKEND_STARTUP_TIMEOUT = 30000; // 30 seconds

// Local storage paths
const getDataDir = () => path.join(app.getPath('userData'), 'data');
const getInvoicesPath = () => path.join(getDataDir(), 'invoices.json');

// Ensure data directory exists
const ensureDataDir = () => {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Load invoices from local storage
const loadInvoices = (): any[] => {
  try {
    ensureDataDir();
    const invoicesPath = getInvoicesPath();
    if (fs.existsSync(invoicesPath)) {
      const data = fs.readFileSync(invoicesPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Error loading invoices:', error);
  }
  return [];
};

// Save invoices to local storage
const saveInvoices = (invoices: any[]) => {
  try {
    ensureDataDir();
    const invoicesPath = getInvoicesPath();
    fs.writeFileSync(invoicesPath, JSON.stringify(invoices, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Error saving invoices:', error);
  }
};

// Initialize sample data if no invoices exist
const initializeSampleData = () => {
  try {
    const invoices = loadInvoices();
    if (invoices.length === 0) {
      const sampleInvoices = [
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-001',
          vendorName: 'Acme Corporation',
          invoiceDate: '2024-01-15',
          dueDate: '2024-02-15',
          subtotal: 1000.00,
          taxAmount: 100.00,
          totalAmount: 1100.00,
          status: 'completed',
          confidenceScore: 0.95,
          notes: 'Sample invoice for testing',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-002',
          vendorName: 'Tech Solutions Inc',
          invoiceDate: '2024-01-20',
          dueDate: '2024-02-20',
          subtotal: 2500.00,
          taxAmount: 250.00,
          totalAmount: 2750.00,
          status: 'completed',
          confidenceScore: 0.92,
          notes: 'Software development services',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: uuidv4(),
          invoiceNumber: 'INV-2024-003',
          vendorName: 'Office Supplies Ltd',
          invoiceDate: '2024-01-25',
          dueDate: '2024-02-25',
          subtotal: 350.00,
          taxAmount: 35.00,
          totalAmount: 385.00,
          status: 'pending',
          confidenceScore: 0.88,
          notes: 'Monthly office supplies',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      saveInvoices(sampleInvoices);
      logger.info('Sample data initialized');
    }
  } catch (error) {
    logger.error('Error initializing sample data:', error);
  }
};

// Check if backend is ready
const waitForBackend = (timeout = BACKEND_STARTUP_TIMEOUT): Promise<boolean> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`http://localhost:${BACKEND_PORT}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          clearInterval(checkInterval);
          backendReady = true;
          logger.info('Backend is ready');
          resolve(true);
        }
      } catch (err) {
        // Backend not ready yet
      }

      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        logger.warn('Backend startup timeout');
        resolve(false);
      }
    }, 1000);
  });
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  const startUrl = isDev
    ? 'http://localhost:5174'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('unresponsive', () => {
    logger.warn('Window became unresponsive');
    dialog.showErrorBox('Warning', 'Application is not responding. Please wait or restart.');
  });
};

const startBackend = async (): Promise<boolean> => {
  if (isDev) {
    logger.info('Development mode: backend should be running separately');
    return true;
  }

  try {
    logger.info('Starting backend process...');
    const backendPath = getBackendPath();

    if (!fs.existsSync(backendPath)) {
      logger.error('Backend executable not found at:', backendPath);
      return false;
    }

    const backendCwd = app.isPackaged
      ? path.resolve(__dirname, '../../backend')
      : path.resolve(__dirname, '../../backend');

    backendProcess = spawn(process.execPath, [backendPath], {
      cwd: backendCwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: BACKEND_PORT.toString(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backendProcess.stdout?.on('data', (data) => {
      logger.debug(`Backend: ${data.toString().trim()}`);
    });

    backendProcess.stderr?.on('data', (data) => {
      logger.warn(`Backend Error: ${data.toString().trim()}`);
    });

    backendProcess.on('error', (err) => {
      logger.error('Failed to start backend:', err);
    });

    backendProcess.on('exit', (code) => {
      logger.info(`Backend process exited with code ${code}`);
      backendReady = false;
    });

    // Wait for backend to be ready
    const ready = await waitForBackend();
    return ready;
  } catch (error) {
    logger.error('Error starting backend:', error);
    return false;
  }
};

const stopBackend = () => {
  if (backendProcess) {
    logger.info('Stopping backend process...');
    backendProcess.kill('SIGTERM');
    backendReady = false;

    // Force kill after 5 seconds if not terminated
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        logger.warn('Force killing backend process');
        backendProcess.kill('SIGKILL');
      }
    }, 5000);
  }
};

app.on('ready', async () => {
  logger.info('Application starting...');

  // Initialize sample data if needed
  initializeSampleData();

  // Backend is not needed for offline local storage mode
  // const backendStarted = await startBackend();
  // if (!isDev && !backendStarted) {
  //   dialog.showErrorBox(
  //     'Startup Error',
  //     'Failed to start the backend service. The application may not work correctly.'
  //   );
  // }

  createWindow();
  createMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackend();
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

const createMenu = () => {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            stopBackend();
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        {
          label: 'Toggle DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          role: 'toggleDevTools',
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About SyntaxisAI',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About SyntaxisAI',
              message: 'SyntaxisAI',
              detail: `Version: ${app.getVersion()}\n\nA modern AI-powered invoice processing application.`,
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

ipcMain.handle('get-backend-status', () => {
  return {
    ready: backendReady,
    port: BACKEND_PORT,
  };
});

// IPC handlers for local invoice storage
ipcMain.handle('invoices:list', (event, options: any = {}) => {
  const invoices = loadInvoices();
  const { page = 1, limit = 10, search = '', status = '' } = options;

  let filtered = invoices;

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(inv =>
      (inv.invoiceNumber?.toLowerCase().includes(searchLower)) ||
      (inv.vendorName?.toLowerCase().includes(searchLower))
    );
  }

  // Apply status filter
  if (status) {
    filtered = filtered.filter(inv => inv.status === status);
  }

  // Sort by createdAt descending
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Paginate
  const total = filtered.length;
  const startIdx = (page - 1) * limit;
  const paginatedInvoices = filtered.slice(startIdx, startIdx + limit);

  return {
    invoices: paginatedInvoices,
    total,
    page,
    limit,
  };
});

ipcMain.handle('invoices:create', (event, invoice: any) => {
  const invoices = loadInvoices();
  const newInvoice = {
    id: uuidv4(),
    ...invoice,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: invoice.status || 'pending',
  };
  invoices.push(newInvoice);
  saveInvoices(invoices);
  return newInvoice;
});

ipcMain.handle('invoices:get', (event, id: string) => {
  const invoices = loadInvoices();
  return invoices.find(inv => inv.id === id) || null;
});

ipcMain.handle('invoices:update', (event, id: string, updates: any) => {
  const invoices = loadInvoices();
  const index = invoices.findIndex(inv => inv.id === id);
  if (index !== -1) {
    invoices[index] = {
      ...invoices[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveInvoices(invoices);
    return invoices[index];
  }
  return null;
});

ipcMain.handle('invoices:delete', (event, id: string) => {
  const invoices = loadInvoices();
  const filtered = invoices.filter(inv => inv.id !== id);
  saveInvoices(filtered);
  return true;
});

// IPC handlers for local file storage
const getFilesDir = () => path.join(getDataDir(), 'files');
const getFilePath = (fileId: string) => path.join(getFilesDir(), fileId);

const ensureFilesDir = () => {
  const filesDir = getFilesDir();
  if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
  }
};

ipcMain.handle('files:upload', async (event, fileData: any) => {
  try {
    ensureFilesDir();
    const fileId = uuidv4();
    const filePath = getFilePath(fileId);

    // Convert base64 to buffer and save
    const buffer = Buffer.from(fileData.data, 'base64');
    fs.writeFileSync(filePath, buffer);

    logger.info(`File uploaded: ${fileId} (${fileData.name})`);

    return {
      success: true,
      fileId,
      filename: fileData.name,
      size: buffer.length,
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error uploading file:', error);
    throw error;
  }
});

ipcMain.handle('files:list', (event) => {
  try {
    ensureFilesDir();
    const filesDir = getFilesDir();
    const files = fs.readdirSync(filesDir);

    return files.map(fileId => {
      const filePath = getFilePath(fileId);
      const stats = fs.statSync(filePath);
      return {
        fileId,
        size: stats.size,
        uploadedAt: stats.birthtime.toISOString(),
      };
    });
  } catch (error) {
    logger.error('Error listing files:', error);
    return [];
  }
});

ipcMain.handle('files:delete', (event, fileId: string) => {
  try {
    const filePath = getFilePath(fileId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`File deleted: ${fileId}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error deleting file:', error);
    throw error;
  }
});

