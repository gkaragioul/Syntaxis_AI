import React, { createContext, useContext, useReducer, useCallback } from 'react';
import {
  WizardSession,
  WizardState,
  WizardStep,
  WizardGroup,
  SetupConfig,
  GroupExportResult,
  STATE_TO_STEP,
  SetupUIStep,
} from '../types/wizard';
import * as wizardService from '../services/wizardService';
import toast from 'react-hot-toast';

// Context state
interface WizardContextState {
  // Session data
  session: WizardSession | null;
  isLoading: boolean;
  error: string | null;

  // Upload state
  selectedFiles: File[];

  // Groups state
  groups: WizardGroup[];
  selectedGroupId: string | null;

  // Setup state
  setupStep: SetupUIStep;
  setupConfig: Partial<SetupConfig>;

  // Export state
  exportResults: Record<string, GroupExportResult>;

  // UI state
  showResumePrompt: boolean;
}

// Actions
type WizardAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SESSION'; payload: WizardSession }
  | { type: 'SET_FILES'; payload: File[] }
  | { type: 'CLEAR_FILES' }
  | { type: 'SET_GROUPS'; payload: WizardGroup[] }
  | { type: 'SELECT_GROUP'; payload: string | null }
  | { type: 'UPDATE_GROUP'; payload: WizardGroup }
  | { type: 'SET_SETUP_STEP'; payload: SetupUIStep }
  | { type: 'UPDATE_SETUP_CONFIG'; payload: Partial<SetupConfig> }
  | { type: 'SET_EXPORT_RESULTS'; payload: Record<string, GroupExportResult> }
  | { type: 'UPDATE_EXPORT_RESULT'; payload: { groupId: string; result: GroupExportResult } }
  | { type: 'SHOW_RESUME_PROMPT'; payload: boolean }
  | { type: 'RESET' };

const initialState: WizardContextState = {
  session: null,
  isLoading: false,
  error: null,
  selectedFiles: [],
  groups: [],
  selectedGroupId: null,
  setupStep: 'select_area',
  setupConfig: {
    headerRows: 1,
    advanced: {
      dropTotals: false,
      removeFootnotes: false,
      strictMode: false,
    },
  },
  exportResults: {},
  showResumePrompt: false,
};

function wizardReducer(state: WizardContextState, action: WizardAction): WizardContextState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SESSION':
      return { ...state, session: action.payload };
    case 'SET_FILES':
      return { ...state, selectedFiles: action.payload };
    case 'CLEAR_FILES':
      return { ...state, selectedFiles: [] };
    case 'SET_GROUPS':
      return { ...state, groups: action.payload };
    case 'SELECT_GROUP':
      return { ...state, selectedGroupId: action.payload, setupStep: 'select_area' };
    case 'UPDATE_GROUP':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.payload.id ? action.payload : g
        ),
      };
    case 'SET_SETUP_STEP':
      return { ...state, setupStep: action.payload };
    case 'UPDATE_SETUP_CONFIG':
      return {
        ...state,
        setupConfig: { ...state.setupConfig, ...action.payload },
      };
    case 'SET_EXPORT_RESULTS':
      return { ...state, exportResults: action.payload };
    case 'UPDATE_EXPORT_RESULT':
      return {
        ...state,
        exportResults: {
          ...state.exportResults,
          [action.payload.groupId]: action.payload.result,
        },
      };
    case 'SHOW_RESUME_PROMPT':
      return { ...state, showResumePrompt: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// Context type
interface WizardContextValue extends WizardContextState {
  // Session actions
  initSession: (forceNew?: boolean) => Promise<void>;
  continueSession: () => void;
  startFresh: () => Promise<void>;

  // Upload actions
  setSelectedFiles: (files: File[]) => void;
  uploadFiles: () => Promise<void>;

  // Groups actions
  fetchGroups: () => Promise<void>;
  selectGroup: (groupId: string | null) => void;
  clusterDocuments: () => Promise<void>;

  // Setup actions
  setSetupStep: (step: SetupUIStep) => void;
  updateSetupConfig: (config: Partial<SetupConfig>) => void;
  saveSetup: () => Promise<void>;

  // Export actions
  exportGroup: (groupId: string) => Promise<void>;
  downloadExport: (groupId: string) => Promise<void>;

  // Navigation helpers
  currentStep: WizardStep;
  canGoNext: boolean;
  goToStep: (step: WizardStep) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // Computed values
  const currentStep: WizardStep = state.session
    ? STATE_TO_STEP[state.session.state as WizardState]
    : 1;

  const canGoNext = (() => {
    switch (currentStep) {
      case 1:
        return state.selectedFiles.length > 0;
      case 2:
        return state.groups.some((g) => g.status === 'ready');
      case 3:
        return state.setupConfig.tableRegion !== undefined;
      case 4:
        return Object.values(state.exportResults).some((r) => r.status === 'completed');
      default:
        return false;
    }
  })();

  // Initialize session on mount
  const initSession = useCallback(async (forceNew = false) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const { session, resumed } = await wizardService.createOrResumeSession(forceNew);
      dispatch({ type: 'SET_SESSION', payload: session });

      if (resumed && session.state !== 'UPLOAD_READY') {
        dispatch({ type: 'SHOW_RESUME_PROMPT', payload: true });
      }

      // Load groups if session has batch job
      if (session.batchJobId) {
        const { groups } = await wizardService.getGroups(session.id);
        dispatch({ type: 'SET_GROUPS', payload: groups });
      }

      // Load export results if available
      if (session.exportResults) {
        dispatch({
          type: 'SET_EXPORT_RESULTS',
          payload: session.exportResults as Record<string, GroupExportResult>,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize session';
      dispatch({ type: 'SET_ERROR', payload: message });
      toast.error(message);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const continueSession = useCallback(() => {
    dispatch({ type: 'SHOW_RESUME_PROMPT', payload: false });
  }, []);

  const startFresh = useCallback(async () => {
    dispatch({ type: 'SHOW_RESUME_PROMPT', payload: false });
    dispatch({ type: 'RESET' });
    await initSession(true);
  }, [initSession]);

  // File actions
  const setSelectedFiles = useCallback((files: File[]) => {
    dispatch({ type: 'SET_FILES', payload: files });
  }, []);

  const uploadFiles = useCallback(async () => {
    if (!state.session || state.selectedFiles.length === 0) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    const loadingId = toast.loading(`Uploading ${state.selectedFiles.length} files...`);

    try {
      const result = await wizardService.uploadFiles(state.session.id, state.selectedFiles);
      toast.success(`Uploaded ${result.uploadedCount} files`, { id: loadingId });

      // Clear files and fetch groups
      dispatch({ type: 'CLEAR_FILES' });

      // Update session state
      const { session } = await wizardService.getSession(state.session.id);
      dispatch({ type: 'SET_SESSION', payload: session });

      // Fetch groups
      const { groups } = await wizardService.getGroups(state.session.id);
      dispatch({ type: 'SET_GROUPS', payload: groups });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message, { id: loadingId });
      dispatch({ type: 'SET_ERROR', payload: message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.session, state.selectedFiles]);

  // Groups actions
  const fetchGroups = useCallback(async () => {
    if (!state.session) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { groups } = await wizardService.getGroups(state.session.id);
      dispatch({ type: 'SET_GROUPS', payload: groups });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load groups';
      toast.error(message);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.session]);

  const selectGroup = useCallback((groupId: string | null) => {
    dispatch({ type: 'SELECT_GROUP', payload: groupId });
  }, []);

  const clusterDocuments = useCallback(async () => {
    if (!state.session) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    const loadingId = toast.loading('Grouping similar documents...');

    try {
      const { groups } = await wizardService.clusterDocuments(state.session.id);
      dispatch({ type: 'SET_GROUPS', payload: groups });
      toast.success('Documents grouped', { id: loadingId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Grouping failed';
      toast.error(message, { id: loadingId });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.session]);

  // Setup actions
  const setSetupStep = useCallback((step: SetupUIStep) => {
    dispatch({ type: 'SET_SETUP_STEP', payload: step });
  }, []);

  const updateSetupConfig = useCallback((config: Partial<SetupConfig>) => {
    dispatch({ type: 'UPDATE_SETUP_CONFIG', payload: config });
  }, []);

  const saveSetup = useCallback(async () => {
    if (!state.session || !state.selectedGroupId || !state.setupConfig.tableRegion) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    const loadingId = toast.loading('Saving setup...');

    try {
      const config: SetupConfig = {
        tableRegion: state.setupConfig.tableRegion,
        headerRows: state.setupConfig.headerRows || 1,
        columnGuides: state.setupConfig.columnGuides,
        preferredColumnMode: state.setupConfig.preferredColumnMode,
        advanced: state.setupConfig.advanced || {
          dropTotals: false,
          removeFootnotes: false,
          strictMode: false,
        },
      };

      const { group } = await wizardService.saveSetup(
        state.session.id,
        state.selectedGroupId,
        config
      );

      dispatch({ type: 'UPDATE_GROUP', payload: group });
      dispatch({ type: 'SELECT_GROUP', payload: null });

      // Update session
      const { session } = await wizardService.getSession(state.session.id);
      dispatch({ type: 'SET_SESSION', payload: session });

      toast.success('Setup saved! This group is now ready for export.', { id: loadingId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save setup';
      toast.error(message, { id: loadingId });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.session, state.selectedGroupId, state.setupConfig]);

  // Export actions
  const exportGroupAction = useCallback(
    async (groupId: string) => {
      if (!state.session) return;

      dispatch({ type: 'SET_LOADING', payload: true });
      const loadingId = toast.loading('Starting export...');

      try {
        const { exportResult } = await wizardService.exportGroup(state.session.id, groupId);
        dispatch({
          type: 'UPDATE_EXPORT_RESULT',
          payload: { groupId, result: exportResult },
        });

        // Update session
        const { session } = await wizardService.getSession(state.session.id);
        dispatch({ type: 'SET_SESSION', payload: session });

        toast.success('Export completed!', { id: loadingId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Export failed';
        toast.error(message, { id: loadingId });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [state.session]
  );

  const downloadExport = useCallback(
    async (groupId: string) => {
      if (!state.session) return;

      try {
        const blob = await wizardService.downloadExport(state.session.id, groupId);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${groupId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('Download started');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Download failed';
        toast.error(message);
      }
    },
    [state.session]
  );

  // Navigation
  const goToStep = useCallback(
    async (step: WizardStep) => {
      if (!state.session) return;

      const stateMap: Record<WizardStep, WizardState> = {
        1: 'UPLOAD_READY',
        2: 'GROUPS_READY',
        3: 'SETUP_IN_PROGRESS',
        4: 'EXPORT_DONE',
      };

      try {
        const { session } = await wizardService.updateSessionState(
          state.session.id,
          stateMap[step],
          step
        );
        dispatch({ type: 'SET_SESSION', payload: session });
      } catch (error) {
        console.error('Failed to update step', error);
      }
    },
    [state.session]
  );

  const value: WizardContextValue = {
    ...state,
    initSession,
    continueSession,
    startFresh,
    setSelectedFiles,
    uploadFiles,
    fetchGroups,
    selectGroup,
    clusterDocuments,
    setSetupStep,
    updateSetupConfig,
    saveSetup,
    exportGroup: exportGroupAction,
    downloadExport,
    currentStep,
    canGoNext,
    goToStep,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
