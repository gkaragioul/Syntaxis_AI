import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useWizard } from '../../contexts/WizardContext';
import { SetupCanvas, SetupCanvasHandle } from './SetupCanvas';
import { PreviewPanel } from './PreviewPanel';
import { SetupUIStep, TableRegion } from '../../types/wizard';
import {
  detectTable,
  detectColumns,
  snapSelection,
  extractPreview,
  getFilePreviewUrl,
  BboxNorm,
  TableCandidate,
  ConfidenceLevel,
  ExtractPreviewResponse,
  DetectColumnsResponse,
  TableMode,
} from '../../services/wizardService';
import { useToast } from '../../hooks/useToast';

const SETUP_STEPS: { key: SetupUIStep; label: string; description: string }[] = [
  {
    key: 'select_area',
    label: 'Select table',
    description: 'Auto-detect or draw the table area, set header rows, and optionally add column guides',
  },
  {
    key: 'preview',
    label: 'Preview',
    description: 'Review the extracted data before saving',
  },
];

const MIN_COLUMNS = 6;

export const SetupStep: React.FC = () => {
  const {
    groups,
    selectedGroupId,
    selectGroup,
    setupStep,
    setSetupStep,
    setupConfig,
    updateSetupConfig,
    saveSetup,
    isLoading,
    goToStep,
    startFresh,
  } = useWizard();

  const { showSuccess, showWarning, showError } = useToast();

  // Table detection state
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState<BboxNorm | null>(null);
  const [gridEstimate, setGridEstimate] = useState<{ approxCols: number; approxRows: number } | null>(null);
  const [candidates, setCandidates] = useState<TableCandidate[]>([]);
  const [isSnapping, setIsSnapping] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const canvasRef = useRef<SetupCanvasHandle | null>(null);

  // Auto-snap toggle (default ON)
  const [autoSnapEnabled, setAutoSnapEnabled] = useState(true);

  // Extracted preview data for confirm_headers step
  const [extractedPreview, setExtractedPreview] = useState<ExtractPreviewResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [useGridColumns, setUseGridColumns] = useState(false);
  const [isDetectingColumns, setIsDetectingColumns] = useState(false);
  const [columnDetection, setColumnDetection] = useState<DetectColumnsResponse | null>(null);
  const [columnDetectionAttempts, setColumnDetectionAttempts] = useState<DetectColumnsResponse[]>([]);
  const [showDetectionDebug, setShowDetectionDebug] = useState(false);
  const [lastDetectionAttempt, setLastDetectionAttempt] = useState<{
    timestamp: Date;
    modeRequested: string;
  } | null>(null);
  const detectionDebugRef = useRef<HTMLDivElement | null>(null);

  // Current detection confidence level and details
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel | null>(null);
  const [confidenceDetails, setConfidenceDetails] = useState<{
    label: string;
    reason: string;
    diagnostics?: { span_count: number; whitespace_ratio_est: number };
  } | null>(null);

  // Manual column guide controls
  const [showColumnGuides, setShowColumnGuides] = useState(true);
  const [addGuideMode, setAddGuideMode] = useState(false);

  // Table mode override
  const [forceMode, setForceMode] = useState<TableMode | undefined>(undefined);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId),
    [groups, selectedGroupId]
  );

  // Compute PDF URL for the representative file
  const pdfUrl = useMemo(() => {
    if (selectedGroup?.representativeFileId) {
      return getFilePreviewUrl(selectedGroup.representativeFileId);
    }
    return undefined;
  }, [selectedGroup?.representativeFileId]);

  // Initialize group name input when group changes
  useEffect(() => {
    if (selectedGroup) {
      setGroupNameInput(selectedGroup.name);
    }
  }, [selectedGroup]);

  // Track last fetched bbox to detect changes
  const lastFetchedBboxRef = useRef<string | null>(null);

  // Track if we've already auto-retried with grid mode
  const autoRetryAttemptedRef = useRef(false);

  // Fetch actual preview data when table region is selected
  useEffect(() => {
    const fetchPreview = async () => {
      // Need file ID and the normalized bbox (from context, persists across steps)
      const bboxNorm = setupConfig.tableRegionNorm || detectedRegion;

      if (!selectedGroup?.representativeFileId || !setupConfig.tableRegion || !bboxNorm) {
        return;
      }

      // Create a key from bbox + columnGuides + useGridColumns + forceMode to track what we've fetched
      const fetchKey = JSON.stringify({ bbox: bboxNorm, guides: setupConfig.columnGuides, useGrid: useGridColumns, forceMode });

      // Skip if we already fetched for this exact config
      if (lastFetchedBboxRef.current === fetchKey) {
        return;
      }

      setIsLoadingPreview(true);
      try {
        const preview = await extractPreview(
          selectedGroup.representativeFileId,
          1, // page number
          bboxNorm,
          setupConfig.columnGuides,
          50, // max rows for preview
          useGridColumns,
          setupConfig.columnBoundaries,  // Pass full boundaries for better extraction
          forceMode  // Pass forced table mode if user selected one
        );
        lastFetchedBboxRef.current = fetchKey;
        setExtractedPreview(preview);

        // Auto-retry with grid mode if:
        // 1. Column detection is poor (< 6 columns)
        // 2. We haven't already retried
        // 3. Grid detection shows more columns available
        // 4. We're not already in grid mode
        const detectedCols = preview.headers.length;
        const gridCols = preview.gridInfo?.columns_detected || 0;

        if (
          detectedCols < MIN_COLUMNS
          && !useGridColumns
          && !autoRetryAttemptedRef.current
          && gridCols >= MIN_COLUMNS
          && !setupConfig.preferredColumnMode
        ) {
          console.log(`[Preview] Auto-retrying with grid mode: detected ${detectedCols} columns, grid has ${gridCols}`);
          autoRetryAttemptedRef.current = true;
          setUseGridColumns(true);
          lastFetchedBboxRef.current = null;
          setExtractedPreview(null);
        }
      } catch (error) {
        console.error('[Preview] Failed to extract preview:', error);
        setExtractedPreview(null);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    fetchPreview();
  }, [selectedGroup?.representativeFileId, setupConfig.tableRegion, setupConfig.tableRegionNorm, detectedRegion, setupConfig.columnGuides, setupConfig.preferredColumnMode, useGridColumns, forceMode]);

  // Reset auto-retry flag when bbox changes
  useEffect(() => {
    autoRetryAttemptedRef.current = false;
    setColumnDetection(null);
    setColumnDetectionAttempts([]);
    setShowDetectionDebug(false);
  }, [setupConfig.tableRegionNorm, detectedRegion]);

  // Get preview data (actual or fallback empty)
  const previewData = useMemo(() => {
    if (extractedPreview && extractedPreview.headers.length > 0) {
      return {
        headers: extractedPreview.headers,
        rows: extractedPreview.rows,
      };
    }
    // Return empty data - PreviewPanel will handle empty state
    return { headers: [], rows: [] };
  }, [extractedPreview]);

  const detectionDebugFinal = columnDetection || columnDetectionAttempts[columnDetectionAttempts.length - 1] || null;
  const detectionDebugFallback = columnDetectionAttempts.length > 1 ? columnDetectionAttempts[0] : null;
  const detectionDebugMode = detectionDebugFinal?.modeUsed || (useGridColumns ? 'gridlines' : 'text');
  const detectionDebugColumns = detectionDebugFinal?.columnsDetected ?? extractedPreview?.headers.length ?? 0;
  const detectionDebugDiagnostics = detectionDebugFinal?.diagnostics || null;

  // Handle auto-detect table with robust pipeline
  const handleAutoDetect = useCallback(async () => {
    console.log('[SetupStep] handleAutoDetect called');
    console.log('[SetupStep] selectedGroup:', selectedGroup);

    if (!selectedGroup?.representativeFileId) {
      console.log('[SetupStep] No representativeFileId, returning early');
      return;
    }

    setIsDetecting(true);
    setConfidenceLevel(null);
    setConfidenceDetails(null);

    try {
      // A) Detect candidates
      const result = await detectTable(selectedGroup.representativeFileId, 1);
      const detectedCandidates = result.candidates || [];
      
      // Dev Log: Candidate list
      console.log('[AutoDetect] Candidates found:', detectedCandidates.length);
      detectedCandidates.forEach((c, i) => console.log(`[AutoDetect] Candidate ${i}:`, c));

      setCandidates(detectedCandidates);

      if (detectedCandidates.length === 0) {
        showWarning('No table candidates detected. Please draw manually.');
        return;
      }

      // SIMPLIFIED: Just use the best candidate directly
      // The backend already ranks by score, so candidate[0] is always the best
      const chosenCandidate = detectedCandidates[0];
      let finalBbox = chosenCandidate.bbox_norm;

      console.log('[AutoDetect] Using top candidate:', chosenCandidate);
      console.log('[AutoDetect] bbox_norm:', finalBbox);

      // Optionally try to snap for tighter fit (but don't block on failure)
      if (autoSnapEnabled && finalBbox) {
        setIsSnapping(true);
        try {
          console.log('[AutoDetect] Attempting snap...');
          const snapResult = await snapSelection(
            selectedGroup.representativeFileId,
            1,
            finalBbox
          );
          console.log('[AutoDetect] Snap succeeded:', snapResult);
          // Use snapped bbox if available
          if (snapResult.bbox_norm_tight) {
            finalBbox = snapResult.bbox_norm_tight;
          }
        } catch (snapError) {
          console.warn('[AutoDetect] Snap failed, using original bbox:', snapError);
          // Keep using original finalBbox
        } finally {
          setIsSnapping(false);
        }
      }

      // D) Commit selection and Auto-Zoom
      console.log('[AutoDetect] Final Choice:', chosenCandidate);
      console.log('[AutoDetect] About to call setDetectedRegion with:', finalBbox);

      setDetectedRegion(finalBbox);
      // Also store in context so it persists across step changes
      updateSetupConfig({ tableRegionNorm: finalBbox });
      console.log('[AutoDetect] setDetectedRegion called');
      if (chosenCandidate.confidence_level) {
        setConfidenceLevel(chosenCandidate.confidence_level);
        setConfidenceDetails({
          label: chosenCandidate.confidence_label || '',
          reason: chosenCandidate.reason || '',
          diagnostics: chosenCandidate.diagnostics,
        });
      }

      if (chosenCandidate.approxCols && chosenCandidate.approxRows) {
        setGridEstimate({
          approxCols: chosenCandidate.approxCols,
          approxRows: chosenCandidate.approxRows,
        });
      }

      // E) Forced Dev Logs & Fit
      if (canvasRef.current && finalBbox) {
         console.log('[AutoDetect] Calling fitSelection with:', finalBbox);
         canvasRef.current.fitSelection(finalBbox, 'AUTO_DETECT_PIPELINE');
      }

      showSuccess('Table found — zoomed in.');

    } catch (error) {
      console.error('Auto-detect failed:', error);
      showError('Failed to detect table. Please try again or draw manually.');
    } finally {
      setIsDetecting(false);
    }
  }, [selectedGroup?.representativeFileId, autoSnapEnabled, showSuccess, showWarning, showError]);

  // Handle selecting a different candidate from suggestions
  const handleSelectCandidate = useCallback((candidate: TableCandidate) => {
    setDetectedRegion(candidate.bbox_norm);
    updateSetupConfig({ tableRegionNorm: candidate.bbox_norm });
    if (candidate.approxCols && candidate.approxRows) {
      setGridEstimate({
        approxCols: candidate.approxCols,
        approxRows: candidate.approxRows,
      });
    }
    // Update confidence for the selected candidate
    if (candidate.confidence_level) {
      setConfidenceLevel(candidate.confidence_level);
      setConfidenceDetails({
        label: candidate.confidence_label || '',
        reason: candidate.reason || '',
        diagnostics: candidate.diagnostics,
      });
    }
  }, [updateSetupConfig]);

  // Handle snap tighter action
  const handleSnapTighter = useCallback(async () => {
    if (!selectedGroup?.representativeFileId || !setupConfig.tableRegion) return;

    // Convert pixel region to normalized bbox
    // For now, we'll use an approximation based on typical container size
    const containerWidth = 600; // Approximate
    const containerHeight = 500; // Approximate

    const bbox_norm: BboxNorm = {
      x0: setupConfig.tableRegion.x / containerWidth,
      y0: setupConfig.tableRegion.y / containerHeight,
      x1: (setupConfig.tableRegion.x + setupConfig.tableRegion.width) / containerWidth,
      y1: (setupConfig.tableRegion.y + setupConfig.tableRegion.height) / containerHeight,
    };

    setIsSnapping(true);
    try {
      const result = await snapSelection(selectedGroup.representativeFileId, 1, bbox_norm);

      // Apply the tightened bbox
      setDetectedRegion(result.bbox_norm_tight);
      updateSetupConfig({ tableRegionNorm: result.bbox_norm_tight });
      setGridEstimate({
        approxCols: result.approxCols,
        approxRows: result.approxRows,
      });

      // Update confidence with snap result
      setConfidenceLevel(result.confidence_level);
      setConfidenceDetails({
        label: result.confidence_label,
        reason: result.reason,
        diagnostics: result.diagnostics,
      });
    } catch (error) {
      console.error('Snap selection failed:', error);
    } finally {
      setIsSnapping(false);
    }
  }, [selectedGroup?.representativeFileId, setupConfig.tableRegion, updateSetupConfig]);

  const applyColumnDetectionResult = useCallback(
    (result: DetectColumnsResponse) => {
      const boundaries = result.columnBoundariesNorm || [];
      const guides = boundaries.length > 2 ? boundaries.slice(1, -1) : [];

      updateSetupConfig({
        columnGuides: guides,
        columnBoundaries: boundaries,  // Store full boundaries for extraction
        preferredColumnMode: result.modeUsed,
      });
      setColumnDetection(result);
      setUseGridColumns(false);

      lastFetchedBboxRef.current = null;
      setExtractedPreview(null);
    },
    [updateSetupConfig]
  );

  const handleDetectColumns = useCallback(async () => {
    if (!selectedGroup?.representativeFileId) return;

    const bboxNorm = setupConfig.tableRegionNorm || detectedRegion;
    if (!bboxNorm) return;

    setIsDetectingColumns(true);
    setColumnDetection(null);
    setColumnDetectionAttempts([]);
    setLastDetectionAttempt({ timestamp: new Date(), modeRequested: 'gridlines' });

    try {
      const attempts: DetectColumnsResponse[] = [];

      const gridlinesResult = await detectColumns(
        selectedGroup.representativeFileId,
        0,
        bboxNorm,
        'gridlines'
      );
      attempts.push(gridlinesResult);

      // Log result for quick sanity check
      console.log('[DetectColumns] gridlines:', {
        mode: gridlinesResult.modeUsed,
        cols: gridlinesResult.columnsDetected,
        candidates: gridlinesResult.diagnostics?.candidateXsCount,
        clusters: gridlinesResult.diagnostics?.clustersCount,
        reason: gridlinesResult.diagnostics?.reasonIfFailed || 'ok',
      });

      let finalResult = gridlinesResult;
      if (gridlinesResult.columnsDetected < MIN_COLUMNS) {
        setLastDetectionAttempt({ timestamp: new Date(), modeRequested: 'image_hough' });
        const houghResult = await detectColumns(
          selectedGroup.representativeFileId,
          0,
          bboxNorm,
          'image_hough'
        );
        attempts.push(houghResult);
        finalResult = houghResult;

        // Log fallback result
        console.log('[DetectColumns] image_hough:', {
          mode: houghResult.modeUsed,
          cols: houghResult.columnsDetected,
          candidates: houghResult.diagnostics?.candidateXsCount,
          clusters: houghResult.diagnostics?.clustersCount,
          reason: houghResult.diagnostics?.reasonIfFailed || 'ok',
        });
      }

      setColumnDetectionAttempts(attempts);
      applyColumnDetectionResult(finalResult);

      // Auto-expand debug panel and scroll into view
      setShowDetectionDebug(true);
      setTimeout(() => {
        detectionDebugRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (error) {
      console.error('[SetupStep] Column detection failed:', error);
      showError('Column detection failed. Please try again.');
    } finally {
      setIsDetectingColumns(false);
    }
  }, [selectedGroup?.representativeFileId, setupConfig.tableRegionNorm, detectedRegion, applyColumnDetectionResult, showError]);

  // Handle clearing all column guides
  const handleClearColumnGuides = useCallback(() => {
    updateSetupConfig({ columnGuides: [], columnBoundaries: [] });
    lastFetchedBboxRef.current = null;
    setExtractedPreview(null);
  }, [updateSetupConfig]);

  // Handle region change (pixel coordinates)
  const handleRegionChange = useCallback(
    async (region: TableRegion) => {
      updateSetupConfig({ tableRegion: region });
    },
    [updateSetupConfig]
  );

  // Handle normalized region change (for API calls)
  const handleNormRegionChange = useCallback(
    (bboxNorm: BboxNorm) => {
      setDetectedRegion(bboxNorm);
      updateSetupConfig({ tableRegionNorm: bboxNorm });
      // Reset the fetch ref so we re-fetch preview data
      lastFetchedBboxRef.current = null;
    },
    [updateSetupConfig]
  );

  // Handle group name save
  const handleSaveGroupName = useCallback(() => {
    // In a real implementation, this would call an API to update the group name
    setEditingGroupName(false);
    // For now, just log it since the backend update isn't implemented yet
    console.log('Would save group name:', groupNameInput);
  }, [groupNameInput]);

  // Handle re-upload request (when PDF fails to load due to missing file on disk)
  const handleReuploadRequest = useCallback(async () => {
    // Start a fresh session
    try {
      await startFresh();
      showSuccess('Starting fresh. Please upload your files again.');
    } catch (error) {
      console.error('Failed to start fresh session:', error);
      // Even if it fails, try to go back to upload step
      goToStep(1);
    }
  }, [startFresh, goToStep, showSuccess]);

  const currentStepIndex = SETUP_STEPS.findIndex((s) => s.key === setupStep);

  const canGoNext = () => {
    switch (setupStep) {
      case 'select_area':
        return setupConfig.tableRegion && setupConfig.tableRegion.width > 0;
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < SETUP_STEPS.length) {
      setSetupStep(SETUP_STEPS[nextIndex].key);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setSetupStep(SETUP_STEPS[prevIndex].key);
    } else {
      // Go back to groups
      selectGroup(null);
    }
  };

  const handleSave = async () => {
    await saveSetup();
  };

  if (!selectedGroup) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No group selected for setup</p>
        <button
          onClick={() => selectGroup(null)}
          className="mt-4 text-blue-600 hover:underline"
        >
          Go back to groups
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - fixed height */}
      <div className="flex-shrink-0 flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center">
            <span className="text-2xl font-bold text-gray-900 mr-2">Set up:</span>
            {editingGroupName ? (
              <div className="flex items-center">
                <input
                  type="text"
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveGroupName();
                    if (e.key === 'Escape') {
                      setEditingGroupName(false);
                      setGroupNameInput(selectedGroup.name);
                    }
                  }}
                  autoFocus
                  className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 bg-transparent outline-none"
                />
                <button
                  onClick={handleSaveGroupName}
                  className="ml-2 p-1 text-green-600 hover:text-green-700"
                  title="Save"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setEditingGroupName(false);
                    setGroupNameInput(selectedGroup.name);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Cancel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingGroupName(true)}
                className="flex items-center text-2xl font-bold text-gray-900 hover:text-blue-600 group"
                title="Click to edit name"
              >
                {selectedGroup.name}
                <svg className="w-4 h-4 ml-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          <p className="mt-1 text-gray-600">
            {selectedGroup.fileCount} documents will use this setup
          </p>
        </div>
        <button
          onClick={() => selectGroup(null)}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Sub-stepper - fixed height */}
      <div className="flex-shrink-0 flex items-center space-x-2 mb-2">
        {SETUP_STEPS.map((step, idx) => (
          <React.Fragment key={step.key}>
            <button
              onClick={() => idx <= currentStepIndex && setSetupStep(step.key)}
              disabled={idx > currentStepIndex}
              className={`
                flex items-center px-3 py-1.5 rounded-full text-sm font-medium
                transition-colors duration-200
                ${
                  step.key === setupStep
                    ? 'bg-blue-600 text-white'
                    : idx < currentStepIndex
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-gray-100 text-gray-400'
                }
              `}
            >
              <span className="mr-1.5">{idx + 1}.</span>
              {step.label}
            </button>
            {idx < SETUP_STEPS.length - 1 && (
              <svg
                className="w-4 h-4 text-gray-300"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Current step content - flex-1 to fill remaining space */}
      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {SETUP_STEPS[currentStepIndex].label}
          </h2>
          <p className="text-sm text-gray-600">
            {SETUP_STEPS[currentStepIndex].description}
          </p>
        </div>

        {/* Step content - takes remaining height */}
        <div className="flex-1 min-h-0 p-2 overflow-hidden">
        {setupStep === 'select_area' && (
          <div className="h-full flex flex-col">
            {/* Canvas area - takes most space */}
            <div className="flex-1 min-h-0">
              <SetupCanvas
                ref={canvasRef}
                pdfUrl={pdfUrl}
                region={setupConfig.tableRegion}
                onRegionChange={handleRegionChange}
                onNormRegionChange={handleNormRegionChange}
                columnGuides={setupConfig.columnGuides}
                onColumnGuidesChange={(guides) => updateSetupConfig({ columnGuides: guides })}
                showColumnGuides={showColumnGuides}
                addGuideMode={addGuideMode}
                onAutoDetect={handleAutoDetect}
                isDetecting={isDetecting}
                detectedRegion={detectedRegion}
                gridEstimate={gridEstimate}
                candidates={candidates}
                onSelectCandidate={handleSelectCandidate}
                onSnapTighter={handleSnapTighter}
                isSnapping={isSnapping}
                autoSnapEnabled={autoSnapEnabled}
                onAutoSnapToggle={setAutoSnapEnabled}
                confidenceLevel={confidenceLevel}
                confidenceDetails={confidenceDetails}
                onReuploadRequest={handleReuploadRequest}
              />
            </div>

            {/* Header preview - shown when table is selected */}
            {setupConfig.tableRegion && setupConfig.tableRegion.width > 0 && (
              <div className="flex-shrink-0 mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                {/* Header detection status */}
                <div className="flex items-center gap-2 mb-2">
                  {isLoadingPreview ? (
                    <>
                      <svg className="animate-spin h-3 w-3 text-blue-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-xs text-gray-600">Detecting header row...</span>
                    </>
                  ) : extractedPreview?.headerDetection ? (
                    <span className={`
                      inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                      ${extractedPreview.headerDetection.confidence >= 0.7 ? 'bg-green-100 text-green-800' : ''}
                      ${extractedPreview.headerDetection.confidence >= 0.4 && extractedPreview.headerDetection.confidence < 0.7 ? 'bg-yellow-100 text-yellow-800' : ''}
                      ${extractedPreview.headerDetection.confidence < 0.4 ? 'bg-red-100 text-red-800' : ''}
                    `}>
                      Header: Row {extractedPreview.headerDetection.headerIndex + 1}
                      {extractedPreview.headerDetection.confidence >= 0.7 ? ' ✓' : ' (review in preview)'}
                    </span>
                  ) : null}
                </div>

                {/* Show actual header row text from detection (not parsed columns) */}
                {extractedPreview?.headerDetection?.candidates && (
                  <div className="text-xs text-gray-700 bg-white px-2 py-1.5 rounded border border-gray-200 font-mono overflow-hidden">
                    <span className="truncate block" title={(() => {
                      const headerIdx = extractedPreview.headerDetection?.headerIndex ?? 0;
                      const headerCandidate = extractedPreview.headerDetection?.candidates.find(
                        (c) => c.index === headerIdx
                      );
                      return headerCandidate?.preview || 'No header detected';
                    })()}>
                      {(() => {
                        const headerIdx = extractedPreview.headerDetection?.headerIndex ?? 0;
                        const headerCandidate = extractedPreview.headerDetection?.candidates.find(
                          (c) => c.index === headerIdx
                        );
                        return headerCandidate?.preview || 'No header detected';
                      })()}
                    </span>
                  </div>
                )}

                {/* Reason for low confidence */}
                {extractedPreview?.headerDetection && extractedPreview.headerDetection.confidence < 0.6 && (
                  <div className="mt-1 text-xs text-amber-600">
                    {extractedPreview.headerDetection.reason || 'Header needs manual verification'}
                  </div>
                )}

                {/* Column count warning - blocking banner when < 6 columns */}
                {extractedPreview && extractedPreview.headers.length > 0 && extractedPreview.headers.length < MIN_COLUMNS && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-red-700 bg-red-50 px-3 py-2 rounded border border-red-200">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-medium">
                        Only {extractedPreview.headers.length} columns detected
                        {extractedPreview.gridInfo?.columns_detected && (
                          <span className="font-normal text-red-600 ml-1">
                            (grid: {extractedPreview.gridInfo.columns_detected})
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-red-600">
                        This table likely has more columns. Preview/export may be incorrect.
                      </p>
                      <button
                        onClick={handleDetectColumns}
                        disabled={isDetectingColumns}
                        className={`mt-1.5 inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          isDetectingColumns
                            ? 'bg-red-300 text-white cursor-wait'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                      >
                        {isDetectingColumns ? (
                          <>
                            <svg className="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Detecting columns...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Try grid-line mode
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Good column detection - show count and chips */}
                {extractedPreview && extractedPreview.headers.length >= MIN_COLUMNS && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {extractedPreview.headers.length} columns detected
                      </span>
                      {extractedPreview.gridInfo?.source && (
                        <span className="text-xs text-gray-500">
                          via {extractedPreview.gridInfo.source}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {extractedPreview.headers.slice(0, 8).map((header, i) => (
                        <span
                          key={i}
                          className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs"
                        >
                          {header || `Col ${i + 1}`}
                        </span>
                      ))}
                      {extractedPreview.headers.length > 8 && (
                        <span className="text-xs text-gray-500">
                          +{extractedPreview.headers.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Column Detection Mode - consolidated control */}
                <div className="mt-3 bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Column Detection</span>
                    {extractedPreview?.modeDetection && (
                      <span className="text-xs text-gray-500">
                        {Math.round(extractedPreview.modeDetection.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>

                  {/* Mode selector - radio button style for clarity */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    <button
                      onClick={() => {
                        setForceMode(undefined);
                        lastFetchedBboxRef.current = null;
                        setExtractedPreview(null);
                      }}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        !forceMode
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      Auto {extractedPreview?.tableMode && !forceMode && `(${extractedPreview.tableMode === 'ASCII_PIPE' ? 'Pipe' : extractedPreview.tableMode === 'GRID_LINES' ? 'Grid' : 'Text'})`}
                    </button>
                    <button
                      onClick={() => {
                        setForceMode('ASCII_PIPE');
                        lastFetchedBboxRef.current = null;
                        setExtractedPreview(null);
                      }}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        forceMode === 'ASCII_PIPE'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                      title="For tables with | pipe separators"
                    >
                      | Pipe
                    </button>
                    <button
                      onClick={() => {
                        setForceMode('GRID_LINES');
                        lastFetchedBboxRef.current = null;
                        setExtractedPreview(null);
                      }}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        forceMode === 'GRID_LINES'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                      title="For tables with visible grid lines"
                    >
                      ▤ Grid
                    </button>
                    <button
                      onClick={() => {
                        setForceMode('TEXT_ALIGNMENT');
                        lastFetchedBboxRef.current = null;
                        setExtractedPreview(null);
                      }}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        forceMode === 'TEXT_ALIGNMENT'
                          ? 'bg-gray-700 text-white border-gray-700'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                      title="For tables without separators (uses text position clustering)"
                    >
                      ≡ Text
                    </button>
                  </div>

                  {/* Detection diagnostics */}
                  {extractedPreview?.modeDetection && (
                    <div className="text-xs text-gray-500">
                      {extractedPreview.modeDetection.pipeDensity > 0.005 && (
                        <span className="mr-3">Pipes: {(extractedPreview.modeDetection.pipeDensity * 100).toFixed(1)}%</span>
                      )}
                      {extractedPreview.modeDetection.separatorLineRate > 0.05 && (
                        <span className="mr-3">Separators: {(extractedPreview.modeDetection.separatorLineRate * 100).toFixed(0)}%</span>
                      )}
                      {extractedPreview.modeDetection.gridDetected && (
                        <span className="text-blue-600">Grid detected</span>
                      )}
                    </div>
                  )}
                </div>

                {extractedPreview && (
                  <div className="mt-2 text-xs" ref={detectionDebugRef}>
                    <button
                      onClick={() => setShowDetectionDebug((prev) => !prev)}
                      className="inline-flex items-center text-gray-600 hover:text-gray-800"
                    >
                      <svg
                        className={`w-3 h-3 mr-1 transition-transform ${showDetectionDebug ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Detection debug
                      {isDetectingColumns && (
                        <span className="ml-2 text-blue-600 animate-pulse">detecting...</span>
                      )}
                    </button>
                    {showDetectionDebug && (
                      <div className="mt-2 bg-white border border-gray-200 rounded p-3 text-gray-700 space-y-2">
                        {/* Timestamp and request info */}
                        {lastDetectionAttempt && (
                          <div className="flex items-center gap-3 text-xs text-gray-500 pb-2 border-b border-gray-100">
                            <span>
                              Last attempt: {lastDetectionAttempt.timestamp.toLocaleTimeString()}
                            </span>
                            <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                              requested: {lastDetectionAttempt.modeRequested}
                            </span>
                          </div>
                        )}

                        {/* Main detection result */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <div>
                            <span className="font-medium text-gray-600">Mode used:</span>{' '}
                            <span className={`font-mono ${detectionDebugMode === 'gridlines' ? 'text-green-700' : 'text-blue-700'}`}>
                              {detectionDebugMode}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Columns:</span>{' '}
                            <span className={`font-mono font-bold ${detectionDebugColumns >= MIN_COLUMNS ? 'text-green-700' : 'text-red-600'}`}>
                              {detectionDebugColumns}
                            </span>
                            {detectionDebugColumns < MIN_COLUMNS && (
                              <span className="text-red-500 ml-1">(need {MIN_COLUMNS}+)</span>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Candidates:</span>{' '}
                            <span className="font-mono">
                              {detectionDebugDiagnostics?.candidateXsCount ?? 'n/a'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Clusters:</span>{' '}
                            <span className="font-mono">
                              {detectionDebugDiagnostics?.clustersCount ?? 'n/a'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Boundaries:</span>{' '}
                            <span className="font-mono">
                              {detectionDebugDiagnostics?.boundariesCount ?? 'n/a'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Status:</span>{' '}
                            {detectionDebugDiagnostics?.reasonIfFailed ? (
                              <span className="text-amber-600 font-mono">{detectionDebugDiagnostics.reasonIfFailed}</span>
                            ) : detectionDebugColumns >= MIN_COLUMNS ? (
                              <span className="text-green-600">ok</span>
                            ) : (
                              <span className="text-red-600">insufficient</span>
                            )}
                          </div>
                        </div>

                        {/* Fallback attempt info */}
                        {detectionDebugFallback && (
                          <div className="pt-2 mt-2 border-t border-gray-200 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-500">1st attempt (gridlines):</span>
                              <span className="font-mono">{detectionDebugFallback.columnsDetected} cols</span>
                              {detectionDebugFallback.diagnostics?.reasonIfFailed && (
                                <span className="text-amber-600">
                                  ({detectionDebugFallback.diagnostics.reasonIfFailed})
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Refine Columns section - manual column guide controls */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-gray-700">Refine Columns</h4>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className="text-xs text-gray-500">Show guides</span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={showColumnGuides}
                          onChange={(e) => setShowColumnGuides(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`block w-8 h-5 rounded-full transition-colors ${showColumnGuides ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${showColumnGuides ? 'translate-x-3' : ''}`}></div>
                      </div>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Auto-split merged columns button */}
                    <button
                      onClick={handleDetectColumns}
                      disabled={isDetectingColumns}
                      className={`inline-flex items-center px-2 py-1 text-xs rounded font-medium ${
                        isDetectingColumns
                          ? 'bg-gray-200 text-gray-400 cursor-wait'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {isDetectingColumns ? (
                        <>
                          <svg className="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Detecting...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Auto-split columns
                        </>
                      )}
                    </button>

                    {/* Add guide mode toggle */}
                    <button
                      onClick={() => setAddGuideMode(!addGuideMode)}
                      className={`inline-flex items-center px-2 py-1 text-xs rounded font-medium ${
                        addGuideMode
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {addGuideMode ? 'Click PDF to add' : 'Add guide'}
                    </button>

                    {/* Clear all guides button */}
                    {(setupConfig.columnGuides?.length ?? 0) > 0 && (
                      <button
                        onClick={handleClearColumnGuides}
                        className="inline-flex items-center px-2 py-1 text-xs rounded font-medium bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear guides ({setupConfig.columnGuides?.length})
                      </button>
                    )}
                  </div>

                  {/* Guide count and hint */}
                  {addGuideMode && (
                    <p className="mt-2 text-xs text-green-600">
                      Click inside the table selection to add column guides. Right-click a guide to remove it.
                    </p>
                  )}

                  {/* Show current guides count */}
                  {(setupConfig.columnGuides?.length ?? 0) > 0 && !addGuideMode && (
                    <p className="mt-2 text-xs text-gray-500">
                      {setupConfig.columnGuides?.length} manual guide{(setupConfig.columnGuides?.length ?? 0) !== 1 ? 's' : ''} set.
                      Click a guide on the PDF to remove it.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {setupStep === 'preview' && (
          isLoadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="ml-3 text-gray-600">Extracting table data...</span>
            </div>
          ) : (
            <PreviewPanel
              headers={previewData.headers}
              rows={previewData.rows}
              totalRows={extractedPreview?.totalRows || previewData.rows.length}
              pdfUrl={pdfUrl}
              tableRegion={setupConfig.tableRegionNorm || detectedRegion}
              columnGuides={setupConfig.columnGuides}
              headerRowIndex={setupConfig.headerRowIndex ?? (extractedPreview?.headerDetection?.headerIndex ?? 0)}
              onHeaderRowIndexChange={(index) => updateSetupConfig({ headerRowIndex: index })}
              onColumnGuidesChange={(guides) => updateSetupConfig({ columnGuides: guides })}
              onReExtract={(options) => {
                // Update useGridColumns if specified
                if (options?.useGridColumns !== undefined) {
                  setUseGridColumns(options.useGridColumns);
                }
                // Reset fetch ref and re-trigger extraction
                lastFetchedBboxRef.current = null;
                setExtractedPreview(null);
              }}
              isLoading={isLoadingPreview}
              hasGridLines={extractedPreview?.gridInfo?.has_grid || false}
              headerDetection={extractedPreview?.headerDetection || null}
            />
          )
        )}
        </div>
      </div>

      {/* Navigation - fixed at bottom */}
      <div className="flex-shrink-0 flex justify-between pt-2">
        <button
          onClick={handleBack}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          ← Back
        </button>

        {setupStep === 'preview' ? (
          <button
            onClick={handleSave}
            disabled={isLoading}
            className={`
              px-6 py-2 rounded-lg font-medium
              ${
                isLoading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {isLoading ? 'Saving...' : 'Save setup'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={!canGoNext()}
            className={`
              px-6 py-2 rounded-lg font-medium
              ${
                !canGoNext()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
};

export default SetupStep;
