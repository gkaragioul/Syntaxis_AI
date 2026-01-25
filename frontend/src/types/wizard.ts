// Wizard state machine types

export type WizardState =
  | 'UPLOAD_READY'
  | 'UPLOADING'
  | 'GROUPING'
  | 'GROUPS_READY'
  | 'SETUP_IN_PROGRESS'
  | 'EXPORT_RUNNING'
  | 'EXPORT_DONE';

export type WizardStep = 1 | 2 | 3 | 4;

export interface WizardSession {
  id: string;
  userId: string;
  state: WizardState;
  currentStep: WizardStep;
  batchJobId?: string;
  groupsData?: WizardGroupsData;
  exportResults?: ExportResults;
  createdAt: string;
  updatedAt: string;
}

export interface WizardGroupsData {
  groups: WizardGroup[];
  totalFiles: number;
  lastUpdated: string;
}

export interface WizardGroup {
  id: string;
  name: string;
  fileCount: number;
  status: 'ready' | 'needs_setup' | 'not_supported';
  files: WizardFile[];
  representativeFileId?: string;
  // Internal - never exposed in UI
  _templateId?: string;
}

export interface WizardFile {
  id: string;
  filename: string;
  pageCount?: number;
  exportStatus?: FileExportStatus;
  reviewReason?: string;
}

export type FileExportStatus = 'pending' | 'exported' | 'needs_review' | 'failed';

export interface BboxNorm {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SetupConfig {
  tableRegion: TableRegion;
  tableRegionNorm?: BboxNorm; // Normalized coordinates (0-1) for API calls
  headerRows: number; // Legacy - kept for backward compatibility
  headerRowIndex?: number; // 0-based index of the header row (auto-detected or user-selected)
  columnGuides?: number[];
  columnBoundaries?: number[]; // Full column boundaries (preferred over guides)
  preferredColumnMode?: 'gridlines' | 'image_hough' | 'text';
  advanced: AdvancedSetupOptions;
}

export interface TableRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

export interface AdvancedSetupOptions {
  dropTotals: boolean;
  removeFootnotes: boolean;
  strictMode: boolean;
}

export interface ExportResults {
  [groupId: string]: GroupExportResult;
}

export interface GroupExportResult {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  totalFiles: number;
  exportedFiles: number;
  filesWithWarnings: number;
  failedFiles: number;
  downloadUrl?: string;
  completedAt?: string;
  fileResults: FileExportResult[];
}

export interface FileExportResult {
  fileId: string;
  filename: string;
  status: FileExportStatus;
  reason?: string;
  csvPath?: string;
}

// API request/response types
export interface CreateSessionResponse {
  session: WizardSession;
}

export interface UploadFilesRequest {
  files: File[];
}

export interface UploadFilesResponse {
  session: WizardSession;
  uploadedCount: number;
}

export interface GetGroupsResponse {
  groups: WizardGroup[];
  totalFiles: number;
}

export interface SaveSetupRequest {
  groupId: string;
  config: SetupConfig;
}

export interface SaveSetupResponse {
  success: boolean;
  group: WizardGroup;
}

export interface ExportGroupRequest {
  groupId: string;
}

export interface ExportGroupResponse {
  status: 'started' | 'already_running';
  exportResult: GroupExportResult;
}

export interface GetDownloadResponse {
  downloadUrl: string;
  expiresAt: string;
}

// UI state types
export interface WizardUIState {
  isLoading: boolean;
  error: string | null;
  selectedGroupId: string | null;
  setupStep: SetupUIStep;
}

export type SetupUIStep =
  | 'select_area'
  | 'preview';

// Step labels for the stepper
export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  1: 'Upload',
  2: 'Group',
  3: 'Setup',
  4: 'Export',
};

// Map states to steps
export const STATE_TO_STEP: Record<WizardState, WizardStep> = {
  UPLOAD_READY: 1,
  UPLOADING: 1,
  GROUPING: 2,
  GROUPS_READY: 2,
  SETUP_IN_PROGRESS: 3,
  EXPORT_RUNNING: 4,
  EXPORT_DONE: 4,
};

// Helper to check if a group can be exported directly
export function canExportDirectly(group: WizardGroup): boolean {
  return group.status === 'ready';
}

// Helper to check if a group needs setup
export function needsSetup(group: WizardGroup): boolean {
  return group.status === 'needs_setup';
}

// Helper to check if a group is not supported
export function isNotSupported(group: WizardGroup): boolean {
  return group.status === 'not_supported';
}

// Helper to get user-friendly group status label
export function getGroupStatusLabel(status: WizardGroup['status']): string {
  switch (status) {
    case 'ready':
      return 'Ready to export';
    case 'needs_setup':
      return 'Needs setup';
    case 'not_supported':
      return 'Not supported';
  }
}

// Helper to get user-friendly file export status label
export function getFileExportStatusLabel(status: FileExportStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'exported':
      return 'Exported';
    case 'needs_review':
      return 'Needs review';
    case 'failed':
      return 'Failed';
  }
}
