import {
  WizardSession,
  WizardGroup,
  SetupConfig,
  GroupExportResult,
  WizardState,
} from '../types/wizard';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * Get the preview URL for a file (PDF viewer)
 */
export function getFilePreviewUrl(fileId: string): string {
  return `${API_BASE}/api/v1/files/${fileId}/preview`;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.detail || 'Request failed');
  }
  const data = await response.json();
  return data.data as T;
}

/**
 * Create a new wizard session or get latest incomplete one
 */
export async function createOrResumeSession(forceNew = false): Promise<{
  session: WizardSession;
  resumed: boolean;
}> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/session`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ forceNew }),
  });
  return handleResponse(response);
}

/**
 * Get wizard session by ID
 */
export async function getSession(sessionId: string): Promise<{ session: WizardSession }> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/${sessionId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Update wizard session state
 */
export async function updateSessionState(
  sessionId: string,
  state: WizardState,
  currentStep?: number
): Promise<{ session: WizardSession }> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/${sessionId}/state`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ state, currentStep }),
  });
  return handleResponse(response);
}

/**
 * Upload files to wizard session
 */
export async function uploadFiles(
  sessionId: string,
  files: File[]
): Promise<{
  batchJobId: string;
  uploadedCount: number;
  files: Array<{ id: string; filename: string }>;
}> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/api/v1/wizard/${sessionId}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return handleResponse(response);
}

/**
 * Get document groups for session
 */
export async function getGroups(sessionId: string): Promise<{
  groups: WizardGroup[];
  totalGroups: number;
}> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/${sessionId}/groups`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Trigger auto-clustering for unassigned documents
 */
export async function clusterDocuments(sessionId: string): Promise<{
  groups: WizardGroup[];
  totalGroups: number;
}> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/${sessionId}/cluster`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Save setup configuration for a group
 */
export async function saveSetup(
  sessionId: string,
  groupId: string,
  config: SetupConfig
): Promise<{ group: WizardGroup }> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/${sessionId}/setup/${groupId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(config),
  });
  return handleResponse(response);
}

/**
 * Start export for a group
 */
export async function exportGroup(
  sessionId: string,
  groupId: string
): Promise<{
  status: 'started' | 'already_running';
  exportResult: GroupExportResult;
}> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/${sessionId}/export/${groupId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Get export results for all groups
 */
export async function getExportResults(sessionId: string): Promise<{
  exportResults: Record<string, GroupExportResult>;
}> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/${sessionId}/export`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Get download URL for exported files
 */
export async function getDownloadUrl(
  sessionId: string,
  groupId: string
): Promise<{ downloadUrl: string }> {
  const response = await fetch(
    `${API_BASE}/api/v1/wizard/${sessionId}/download/${groupId}`,
    {
      headers: getAuthHeaders(),
    }
  );
  return handleResponse(response);
}

/**
 * Delete a wizard session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/${sessionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Delete failed' }));
    throw new Error(error.message || 'Delete failed');
  }
}

/**
 * Download export as ZIP file
 */
export async function downloadExport(sessionId: string, groupId: string): Promise<Blob> {
  const token = localStorage.getItem('token');
  const response = await fetch(
    `${API_BASE}/api/v1/wizard/${sessionId}/download/${groupId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Download failed');
  }

  return response.blob();
}

// Table detection types
export interface BboxNorm {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type ConfidenceLevel = 'good' | 'suspicious' | 'likely_wrong';

export interface TableDiagnostics {
  span_count: number;
  whitespace_ratio_est: number;
}

export interface TableCandidate {
  bbox_norm: BboxNorm;
  score: number;
  reason?: string;
  confidence_level?: ConfidenceLevel;
  confidence_label?: string;
  diagnostics?: TableDiagnostics;
  approxCols?: number;
  approxRows?: number;
}

export interface DetectTableResponse {
  candidates: TableCandidate[];
  recommended: TableCandidate;
  pageNumber: number;
}

export interface EstimateGridResponse {
  approxCols: number;
  approxRows: number;
  confidence: number;
}

export interface FilePageInfo {
  fileId: string;
  filename: string;
  pageNumber: number;
  totalPages: number;
  previewUrl: string;
}

/**
 * Auto-detect table regions in a PDF page
 */
export async function detectTable(
  fileId: string,
  pageNumber: number = 1
): Promise<DetectTableResponse> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/detect-table`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fileId, pageNumber }),
  });
  return handleResponse(response);
}

/**
 * Estimate columns and rows within a selected table region
 */
export async function estimateGrid(
  fileId: string,
  pageNumber: number,
  bbox_norm: BboxNorm
): Promise<EstimateGridResponse> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/estimate-grid`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fileId, pageNumber, bbox_norm }),
  });
  return handleResponse(response);
}

/**
 * Get file page info for PDF rendering
 */
export async function getFilePageInfo(
  fileId: string,
  pageNumber: number = 1
): Promise<FilePageInfo> {
  const response = await fetch(
    `${API_BASE}/api/v1/wizard/file/${fileId}/page/${pageNumber}`,
    {
      headers: getAuthHeaders(),
    }
  );
  return handleResponse(response);
}

export interface SnapSelectionResponse {
  bbox_norm_tight: BboxNorm;
  score: number;
  reason: string;
  confidence_level: ConfidenceLevel;
  confidence_label: string;
  diagnostics: TableDiagnostics;
  approxCols: number;
  approxRows: number;
  shrinkRatio: number;
}

/**
 * Snap/tighten a selection to the densest table content
 */
export async function snapSelection(
  fileId: string,
  pageNumber: number,
  bbox_norm: BboxNorm
): Promise<SnapSelectionResponse> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/snap-selection`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fileId, pageNumber, bbox_norm }),
  });
  return handleResponse(response);
}

export interface GridInfo {
  columns: number[];
  column_boundaries?: number[];
  columns_detected: number;
  has_grid: boolean;
  column_count?: number; // Deprecated, use columns_detected
  raw_line_count?: number;
  source?: 'gridlines' | 'image_hough' | 'text_clustering';
  diagnostics?: {
    clusters_found?: number;
    valid_separators?: number;
    reason?: string;
  };
}

export type ColumnDetectionMode = 'gridlines' | 'image_hough' | 'text';

export interface DetectColumnsResponse {
  columnsDetected: number;
  columnBoundariesNorm: number[];
  modeUsed: ColumnDetectionMode;
  diagnostics: {
    candidateXsCount: number;
    clustersCount: number;
    boundariesCount: number;
    reasonIfFailed?: string;
  };
}

export interface HeaderCandidate {
  index: number;
  score: number;
  coverage: number;
  textRatio: number;
  headerKeywords: number;
  titleKeywords: number;
  isSeparator: boolean;
  isTitleRow: boolean;
  qualifies: boolean;
  preview: string;
  reasons: string[];
}

export interface HeaderDetection {
  headerIndex: number;
  headerSpan: number;
  confidence: number;
  reason: string;
  candidates: HeaderCandidate[];
}

export type TableMode = 'ASCII_PIPE' | 'GRID_LINES' | 'TEXT_ALIGNMENT';

export interface ModeDetection {
  mode: TableMode;
  confidence: number;
  pipeDensity: number;
  separatorLineRate: number;
  gridDetected: boolean;
  gridColumnCount?: number;
  reason: string;
}

export interface ExtractPreviewResponse {
  headers: string[];
  rows: string[][];
  totalRows: number;
  totalCols: number;
  gridInfo?: GridInfo;
  headerDetection?: HeaderDetection;
  tableMode?: TableMode;
  modeDetection?: ModeDetection;
  separatorRows?: number[];
  diagnostics?: Record<string, unknown>;
}

/**
 * Extract table preview (headers and first N rows) from a selected region
 */
export async function extractPreview(
  fileId: string,
  pageNumber: number,
  bbox_norm: BboxNorm,
  columnGuides?: number[],
  maxRows: number = 10,
  useGridColumns: boolean = false,
  columnBoundaries?: number[],  // Full column boundaries (preferred over guides)
  forceMode?: TableMode  // Force a specific table mode (ASCII_PIPE, GRID_LINES, TEXT_ALIGNMENT)
): Promise<ExtractPreviewResponse> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/extract-preview`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fileId, pageNumber, bbox_norm, columnGuides, columnBoundaries, maxRows, useGridColumns, forceMode }),
  });
  return handleResponse(response);
}

export interface DetectGridColumnsResponse {
  columns: number[];
  has_grid: boolean;
  column_count: number;
  raw_line_count?: number;
}

/**
 * Detect column boundaries from vertical grid lines in a PDF region
 */
export async function detectGridColumns(
  fileId: string,
  pageNumber: number,
  bbox_norm: BboxNorm
): Promise<DetectGridColumnsResponse> {
  const response = await fetch(`${API_BASE}/api/v1/wizard/detect-grid-columns`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fileId, pageNumber, bbox_norm }),
  });
  return handleResponse(response);
}

/**
 * Detect columns using a specified detection mode (gridlines or image_hough).
 */
export async function detectColumns(
  pdfId: string,
  pageIndex: number,
  selectionBbox: BboxNorm,
  mode: ColumnDetectionMode
): Promise<DetectColumnsResponse> {
  const response = await fetch(`${API_BASE}/api/detect-columns`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ pdfId, pageIndex, selectionBbox, mode }),
  });
  return handleResponse(response);
}
