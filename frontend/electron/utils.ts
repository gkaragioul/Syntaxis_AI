import path from 'path';
import { app } from 'electron';
import * as fs from 'fs';

/**
 * Get the path to the application resources directory
 */
export const getResourcesPath = (): string => {
  if (process.env.NODE_ENV === 'development') {
    return path.join(__dirname, '..');
  }
  return path.join(app.getAppPath(), '..');
};

/**
 * Get the path to user data directory
 */
export const getUserDataPath = (): string => {
  return app.getPath('userData');
};

/**
 * Get the path to app logs directory
 */
export const getLogsPath = (): string => {
  const logsPath = path.join(getUserDataPath(), 'logs');
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
  }
  return logsPath;
};

/**
 * Get the path to app config directory
 */
export const getConfigPath = (): string => {
  const configPath = path.join(getUserDataPath(), 'config');
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(configPath, { recursive: true });
  }
  return configPath;
};

/**
 * Get the path to app data directory
 */
export const getDataPath = (): string => {
  const dataPath = path.join(getUserDataPath(), 'data');
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  return dataPath;
};

/**
 * Get the path to backend executable
 */
export const getBackendPath = (): string => {
  // In packaged app, __dirname points to resources/app/dist-electron
  // Our extraResources put backend under resources/backend
  if (app.isPackaged) {
    const resourcesDir = path.resolve(__dirname, '..', '..'); // -> resources
    return path.join(resourcesDir, 'backend', 'dist', 'index.js');
  }
  // In dev: __dirname is <repo>/frontend/dist-electron
  return path.resolve(__dirname, '../../backend/dist/index.js');
};

/**
 * Check if a path exists
 */
export const pathExists = (filePath: string): boolean => {
  return fs.existsSync(filePath);
};

/**
 * Read JSON file
 */
export const readJsonFile = <T>(filePath: string): T | null => {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}:`, error);
    return null;
  }
};

/**
 * Write JSON file
 */
export const writeJsonFile = <T>(filePath: string, data: T): boolean => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error writing JSON file ${filePath}:`, error);
    return false;
  }
};

/**
 * Get app version
 */
export const getAppVersion = (): string => {
  return app.getVersion();
};

/**
 * Get app name
 */
export const getAppName = (): string => {
  return app.getName();
};

/**
 * Check if running in development mode
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

/**
 * Check if running in production mode
 */
export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

/**
 * Get platform
 */
export const getPlatform = (): string => {
  return process.platform;
};

/**
 * Check if running on Windows
 */
export const isWindows = (): boolean => {
  return process.platform === 'win32';
};

/**
 * Check if running on macOS
 */
export const isMacOS = (): boolean => {
  return process.platform === 'darwin';
};

/**
 * Check if running on Linux
 */
export const isLinux = (): boolean => {
  return process.platform === 'linux';
};

