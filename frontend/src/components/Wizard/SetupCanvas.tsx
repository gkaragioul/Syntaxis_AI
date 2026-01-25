import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, useImperativeHandle } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { TableRegion } from '../../types/wizard';
import { BboxNorm, TableCandidate, ConfidenceLevel } from '../../services/wizardService';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Debug logging (only in development)
const DEBUG = import.meta.env.DEV;

interface ConfidenceDetails {
  label: string;
  reason: string;
  diagnostics?: { span_count: number; whitespace_ratio_est: number };
}

interface SetupCanvasProps {
  pdfUrl?: string;
  region?: TableRegion;
  onRegionChange: (region: TableRegion) => void;
  onNormRegionChange?: (bboxNorm: BboxNorm) => void;
  columnGuides?: number[];
  onColumnGuidesChange?: (guides: number[]) => void;
  showColumnGuides?: boolean;
  addGuideMode?: boolean;
  onAutoDetect?: () => void;
  isDetecting?: boolean;
  detectedRegion?: BboxNorm | null;
  gridEstimate?: { approxCols: number; approxRows: number } | null;
  candidates?: TableCandidate[];
  onSelectCandidate?: (candidate: TableCandidate) => void;
  onSnapTighter?: () => void;
  isSnapping?: boolean;
  autoSnapEnabled?: boolean;
  onAutoSnapToggle?: (enabled: boolean) => void;
  confidenceLevel?: ConfidenceLevel | null;
  confidenceDetails?: ConfidenceDetails | null;
  onReuploadRequest?: () => void;
}

export interface SetupCanvasHandle {
  fitSelection: (bboxOverride?: BboxNorm, reason?: string) => void;
}

type DrawMode = 'none' | 'drawing' | 'moving' | 'resizing';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

// Explicit zoom mode for clarity
type ZoomMode = 'fitWidth' | 'fitSelection' | 'manual';

export const SetupCanvas = React.forwardRef<SetupCanvasHandle, SetupCanvasProps>(({
  pdfUrl,
  region,
  onRegionChange,
  onNormRegionChange,
  columnGuides = [],
  onColumnGuidesChange,
  showColumnGuides: showColumnGuidesFromParent = true,
  addGuideMode = false,
  onAutoDetect,
  isDetecting = false,
  detectedRegion,
  gridEstimate,
  candidates = [],
  onSelectCandidate,
  onSnapTighter,
  isSnapping = false,
  autoSnapEnabled = true,
  onAutoSnapToggle,
  confidenceLevel,
  confidenceDetails,
  onReuploadRequest,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRegion, setCurrentRegion] = useState<TableRegion | null>(region || null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  // PDF viewer state
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScaleRaw] = useState<number>(1.0);

  // Explicit zoom mode tracking
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fitWidth');

  // Debug toggle for dev overlay (off by default)
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);

  // Tracing wrapper for setScale to find who overwrites it
  const setScale = useCallback((nextOrFn: number | ((prev: number) => number), reason?: string) => {
    setScaleRaw((prev) => {
      const next = typeof nextOrFn === 'function' ? nextOrFn(prev) : nextOrFn;
      if (DEBUG) {
        console.log(`[setScale] ${reason || 'UNKNOWN'}:`, { prev, next, stack: new Error().stack?.split('\n').slice(2, 5).join(' <- ') });
      }
      return next;
    });
  }, []);
  const [pdfLoaded, setPdfLoaded] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [showTip, setShowTip] = useState<boolean>(true);
  const [manualDrawMode, setManualDrawMode] = useState<boolean>(false);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number>(0);
  const [hoveredCandidateIndex, setHoveredCandidateIndex] = useState<number | null>(null);

  // Controls panel state
  const [controlsOpen, setControlsOpen] = useState<boolean>(true);
  const [enhanceReadability, setEnhanceReadability] = useState<boolean>(false);

  // Base PDF page dimensions (at scale=1)
  const [basePageWidth, setBasePageWidth] = useState<number>(0);
  const [basePageHeight, setBasePageHeight] = useState<number>(0);

  // Viewer viewport dimensions (the scroll container, NOT the canvas wrapper)
  const [viewerWidth, setViewerWidth] = useState<number>(0);
  const [viewerHeight, setViewerHeight] = useState<number>(0);

  // Page wrapper ref
  const pageWrapperRef = useRef<HTMLDivElement>(null);

  // Selection in normalized coordinates (0..1)
  const [selectionNorm, setSelectionNorm] = useState<BboxNorm | null>(null);

  // Control flags
  const hasUserZoomedRef = useRef<boolean>(false);
  const [initialFitWidthDone, setInitialFitWidthDone] = useState<boolean>(false);
  const lastDetectedRegionRef = useRef<string | null>(null);

  // Computed rendered dimensions
  const renderedPageWidth = basePageWidth * scale;
  const renderedPageHeight = basePageHeight * scale;

  // Convert normalized bbox to pixel coordinates (at current scale)
  const normToPixel = useCallback(
    (norm: BboxNorm, pageW: number, pageH: number, currentScale: number): TableRegion => {
      const rw = pageW * currentScale;
      const rh = pageH * currentScale;
      return {
        x: norm.x0 * rw,
        y: norm.y0 * rh,
        width: (norm.x1 - norm.x0) * rw,
        height: (norm.y1 - norm.y0) * rh,
      };
    },
    []
  );

  // Convert pixel coordinates to normalized bbox
  const pixelToNorm = useCallback(
    (reg: TableRegion, pageW: number, pageH: number, currentScale: number): BboxNorm => {
      const rw = pageW * currentScale;
      const rh = pageH * currentScale;
      if (rw === 0 || rh === 0) {
        return { x0: 0, y0: 0, x1: 0, y1: 0 };
      }
      return {
        x0: reg.x / rw,
        y0: reg.y / rh,
        x1: (reg.x + reg.width) / rw,
        y1: (reg.y + reg.height) / rh,
      };
    },
    []
  );

  // Compute fit-width scale (pure function)
  // padding = 12px on each side = 24px total (reduced for more content space)
  const computeFitWidthScale = useCallback((pageW: number, viewerW: number): number => {
    if (pageW <= 0 || viewerW <= 0) return 1.0;
    const padding = 24; // 12px padding on each side
    const availableWidth = viewerW - padding;
    const fitScale = availableWidth / pageW;
    const clamped = Math.max(0.3, Math.min(fitScale, 6.0));
    if (DEBUG) {
      console.log('[computeFitWidthScale]', { pageW, viewerW, availableWidth, fitScale, clamped });
    }
    return clamped;
  }, []);

  // Measure the viewer viewport (the scroll container) using ResizeObserver
  // This is the ONLY place we update viewerWidth/viewerHeight
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const measure = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          setViewerWidth(w);
          setViewerHeight(h);
          if (DEBUG) {
            console.log('[SetupCanvas] Viewport measured:', { w, h });
          }
        }
      }
    };

    // Use ResizeObserver for accurate measurements
    const resizeObserver = new ResizeObserver(() => {
      measure();
    });
    resizeObserver.observe(containerRef.current);

    // Also measure immediately after a frame to catch initial layout
    requestAnimationFrame(() => {
      measure();
    });

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Re-measure when controls panel toggles (with delay for animation)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          setViewerWidth(w);
          setViewerHeight(h);
        }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [controlsOpen]);

  // Initial Fit Width - runs once when BOTH page dimensions AND viewer dimensions are ready
  useEffect(() => {
    if (DEBUG) {
      console.log('[Initial Fit Width Effect] Checking:', {
        basePageWidth,
        viewerWidth,
        initialFitWidthDone,
        hasUserZoomed: hasUserZoomedRef.current,
      });
    }

    if (
      basePageWidth > 0 &&
      viewerWidth > 100 &&
      !initialFitWidthDone &&
      !hasUserZoomedRef.current
    ) {
      const newScale = computeFitWidthScale(basePageWidth, viewerWidth);
      if (DEBUG) {
        console.log('[Initial Fit Width Effect] APPLYING:', { newScale });
      }
      // Apply directly without requestAnimationFrame to avoid race conditions
      setScale(newScale, 'INITIAL_FIT_WIDTH');
      setInitialFitWidthDone(true);
    }
  }, [basePageWidth, viewerWidth, computeFitWidthScale, setScale, initialFitWidthDone]);

  // Apply detected region when received
  useEffect(() => {
    console.log('[SetupCanvas] detectedRegion effect triggered:', {
      hasDetectedRegion: !!detectedRegion,
      detectedRegion,
      basePageWidth,
      basePageHeight
    });

    if (!detectedRegion) {
      console.log('[SetupCanvas] No detectedRegion, skipping');
      return;
    }

    if (basePageWidth === 0) {
      console.log('[SetupCanvas] basePageWidth is 0, waiting for PDF to load...');
      return;
    }

    // Create a unique key for this detection to avoid reprocessing
    const detectionKey = JSON.stringify(detectedRegion);
    if (detectionKey === lastDetectedRegionRef.current) {
      console.log('[SetupCanvas] Same detection key, skipping duplicate');
      return;
    }
    lastDetectedRegionRef.current = detectionKey;

    console.log('[SetupCanvas] APPLYING detected region:', detectedRegion);

    setSelectionNorm(detectedRegion);
    const pixelRegion = normToPixel(detectedRegion, basePageWidth, basePageHeight, scale);
    console.log('[SetupCanvas] Computed pixelRegion:', pixelRegion);
    setCurrentRegion(pixelRegion);
    onRegionChange(pixelRegion);
    setShowTip(false);
    console.log('[SetupCanvas] Selection applied successfully');
  }, [detectedRegion, basePageWidth, basePageHeight, scale, normToPixel, onRegionChange, viewerWidth, viewerHeight]);

  // When scale changes, update pixel region from normalized
  useEffect(() => {
    if (selectionNorm && basePageWidth > 0) {
      const pixelRegion = normToPixel(selectionNorm, basePageWidth, basePageHeight, scale);
      setCurrentRegion(pixelRegion);
    }
  }, [scale, selectionNorm, basePageWidth, basePageHeight, normToPixel]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentRegion) return;

      if (e.key === 'Escape') {
        setCurrentRegion(null);
        onRegionChange({ x: 0, y: 0, width: 0, height: 0 });
        setShowTip(true);
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      let newRegion = { ...currentRegion };

      switch (e.key) {
        case 'ArrowUp':
          newRegion.y -= step;
          break;
        case 'ArrowDown':
          newRegion.y += step;
          break;
        case 'ArrowLeft':
          newRegion.x -= step;
          break;
        case 'ArrowRight':
          newRegion.x += step;
          break;
        default:
          return;
      }

      e.preventDefault();
      setCurrentRegion(newRegion);
      onRegionChange(newRegion);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRegion, onRegionChange]);

  const getRelativePosition = useCallback(
    (e: React.MouseEvent): { x: number; y: number } | null => {
      const ref = pageWrapperRef.current || containerRef.current;
      if (!ref) return null;
      const rect = ref.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(e.clientX - rect.left, renderedPageWidth || rect.width)),
        y: Math.max(0, Math.min(e.clientY - rect.top, renderedPageHeight || rect.height)),
      };
    },
    [renderedPageWidth, renderedPageHeight]
  );

  const getResizeHandle = useCallback(
    (pos: { x: number; y: number }, reg: TableRegion): ResizeHandle => {
      const handleSize = 10;
      const { x, y, width, height } = reg;

      if (pos.x >= x - handleSize && pos.x <= x + handleSize &&
          pos.y >= y - handleSize && pos.y <= y + handleSize) return 'nw';
      if (pos.x >= x + width - handleSize && pos.x <= x + width + handleSize &&
          pos.y >= y - handleSize && pos.y <= y + handleSize) return 'ne';
      if (pos.x >= x - handleSize && pos.x <= x + handleSize &&
          pos.y >= y + height - handleSize && pos.y <= y + height + handleSize) return 'sw';
      if (pos.x >= x + width - handleSize && pos.x <= x + width + handleSize &&
          pos.y >= y + height - handleSize && pos.y <= y + height + handleSize) return 'se';

      return null;
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = getRelativePosition(e);
      if (!pos) return;

      // Column guides mode: when we have a selection and column guide callback is provided
      const inColumnGuidesMode = currentRegion && currentRegion.width > 0 && !!onColumnGuidesChange;

      // In column guides mode, only allow resize - clicks inside selection add column guides via onClick
      if (inColumnGuidesMode) {
        const handle = getResizeHandle(pos, currentRegion);
        if (handle) {
          setDrawMode('resizing');
          setActiveHandle(handle);
          setStartPoint(pos);
          return;
        }
        // Don't start move mode in column guides - let onClick handle adding guides
        // Don't allow drawing new regions in column mode
        return;
      }

      if (currentRegion) {
        const handle = getResizeHandle(pos, currentRegion);
        if (handle) {
          setDrawMode('resizing');
          setActiveHandle(handle);
          setStartPoint(pos);
          return;
        }

        if (pos.x >= currentRegion.x && pos.x <= currentRegion.x + currentRegion.width &&
            pos.y >= currentRegion.y && pos.y <= currentRegion.y + currentRegion.height) {
          setDrawMode('moving');
          setDragOffset({ x: pos.x - currentRegion.x, y: pos.y - currentRegion.y });
          return;
        }
      }

      if (manualDrawMode || !currentRegion) {
        setDrawMode('drawing');
        setStartPoint(pos);
        setCurrentRegion(null);
      }
    },
    [getRelativePosition, getResizeHandle, currentRegion, onColumnGuidesChange, manualDrawMode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = getRelativePosition(e);
      if (!pos) return;

      if (drawMode === 'drawing' && startPoint) {
        const x = Math.min(startPoint.x, pos.x);
        const y = Math.min(startPoint.y, pos.y);
        const width = Math.abs(pos.x - startPoint.x);
        const height = Math.abs(pos.y - startPoint.y);
        setCurrentRegion({ x, y, width, height });
      } else if (drawMode === 'moving' && currentRegion && dragOffset) {
        const newX = Math.max(0, Math.min(pos.x - dragOffset.x, renderedPageWidth - currentRegion.width));
        const newY = Math.max(0, Math.min(pos.y - dragOffset.y, renderedPageHeight - currentRegion.height));
        setCurrentRegion({ ...currentRegion, x: newX, y: newY });
      } else if (drawMode === 'resizing' && currentRegion && startPoint && activeHandle) {
        let newRegion = { ...currentRegion };
        const dx = pos.x - startPoint.x;
        const dy = pos.y - startPoint.y;

        switch (activeHandle) {
          case 'nw':
            newRegion.x += dx;
            newRegion.y += dy;
            newRegion.width -= dx;
            newRegion.height -= dy;
            break;
          case 'ne':
            newRegion.y += dy;
            newRegion.width += dx;
            newRegion.height -= dy;
            break;
          case 'sw':
            newRegion.x += dx;
            newRegion.width -= dx;
            newRegion.height += dy;
            break;
          case 'se':
            newRegion.width += dx;
            newRegion.height += dy;
            break;
        }

        if (newRegion.width < 20) newRegion.width = 20;
        if (newRegion.height < 20) newRegion.height = 20;

        setCurrentRegion(newRegion);
        setStartPoint(pos);
      }
    },
    [drawMode, startPoint, currentRegion, dragOffset, activeHandle, getRelativePosition, renderedPageWidth, renderedPageHeight]
  );

  const fitSelection = useCallback(
    (bboxOverride?: BboxNorm, reason: string = 'FIT_SELECTION') => {
      const target = bboxOverride || selectionNorm;
      if (!target || basePageWidth === 0 || basePageHeight === 0) return;

      const padding = 32; // 16px each side for selection fit
      const availableW = viewerWidth - padding;
      const availableH = viewerHeight - padding;
      if (availableW <= 0 || availableH <= 0) return;

      const selW1 = (target.x1 - target.x0) * basePageWidth;
      const selH1 = (target.y1 - target.y0) * basePageHeight;
      if (selW1 <= 0 || selH1 <= 0) return;

      const scaleW = availableW / selW1;
      const scaleH = availableH / selH1;
      const desiredScale = Math.min(scaleW, scaleH);
      const clampedScale = Math.max(0.3, Math.min(desiredScale, 6.0));

      console.log('fitSelection target:', target);
      console.log('fitSelection computed:', { availableW, availableH, selW1, selH1, scaleW, scaleH, desiredScale, clampedScale });

      setScale(clampedScale, reason);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const selCenterX1 = ((target.x0 + target.x1) / 2) * basePageWidth;
            const selCenterY1 = ((target.y0 + target.y1) / 2) * basePageHeight;
            const selCenterXpx = selCenterX1 * clampedScale;
            const selCenterYpx = selCenterY1 * clampedScale;
            const wrapperPadding = 16;
            const scrollLeft = selCenterXpx + wrapperPadding - containerRef.current.clientWidth / 2;
            const scrollTop = selCenterYpx + wrapperPadding - containerRef.current.clientHeight / 2;
            
            console.log('fitSelection centering:', { selCenterXpx, selCenterYpx, scrollLeft, scrollTop });
            
            containerRef.current.scrollTo({
              left: Math.max(0, scrollLeft),
              top: Math.max(0, scrollTop),
              behavior: 'smooth',
            });
          }
        });
      });
    },
    [selectionNorm, basePageWidth, basePageHeight, viewerWidth, viewerHeight, setScale]
  );

  useImperativeHandle(ref, () => ({ fitSelection }), [fitSelection]);

  const handleMouseUp = useCallback(() => {
    if (drawMode === 'drawing' && currentRegion && currentRegion.width > 10 && currentRegion.height > 10) {
      const norm = pixelToNorm(currentRegion, basePageWidth, basePageHeight, scale);
      const shouldAutoFit = !selectionNorm;
      setSelectionNorm(norm);
      onRegionChange(currentRegion);
      onNormRegionChange?.(norm);
      setShowTip(false);
      setManualDrawMode(false);

      if (DEBUG) {
        console.log('selectionNorm set');
      }

      if (shouldAutoFit) {
        fitSelection(norm, 'AUTO_FIT_AFTER_MANUAL_DRAW');
      }
    } else if (drawMode === 'moving' || drawMode === 'resizing') {
      if (currentRegion) {
        const norm = pixelToNorm(currentRegion, basePageWidth, basePageHeight, scale);
        setSelectionNorm(norm);
        onRegionChange(currentRegion);
        onNormRegionChange?.(norm);
        if (DEBUG) {
          console.log('selectionNorm set');
        }
      }
    }
    setDrawMode('none');
    setStartPoint(null);
    setDragOffset(null);
    setActiveHandle(null);
  }, [drawMode, currentRegion, onRegionChange, onNormRegionChange, pixelToNorm, basePageWidth, basePageHeight, scale, selectionNorm, fitSelection]);

  const handleAddColumnGuide = useCallback(
    (e: React.MouseEvent) => {
      if (!onColumnGuidesChange || !currentRegion || currentRegion.width <= 0) return;
      if (!renderedPageWidth) return;

      const pos = getRelativePosition(e);
      if (pos && pos.x >= currentRegion.x && pos.x <= currentRegion.x + currentRegion.width) {
        const normalizedX = Math.max(0, Math.min(pos.x / renderedPageWidth, 1));
        const newGuides = [...columnGuides, normalizedX].sort((a, b) => a - b);
        onColumnGuidesChange(newGuides);
      }
    },
    [onColumnGuidesChange, currentRegion, columnGuides, getRelativePosition, renderedPageWidth]
  );

  const handleClearSelection = useCallback(() => {
    setCurrentRegion(null);
    setSelectionNorm(null);
    onRegionChange({ x: 0, y: 0, width: 0, height: 0 });
    onNormRegionChange?.({ x0: 0, y0: 0, x1: 0, y1: 0 });
    setShowTip(true);
    lastDetectedRegionRef.current = null;
  }, [onRegionChange, onNormRegionChange]);

  const handleSelectCandidate = useCallback((index: number) => {
    if (candidates[index] && onSelectCandidate) {
      setSelectedCandidateIndex(index);
      onSelectCandidate(candidates[index]);
    }
  }, [candidates, onSelectCandidate]);

  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(scale * 1.1, 3.0);  // 10% increment, max 3x
    setScale(newScale, 'USER_ZOOM_IN');
    setZoomMode('manual');
    hasUserZoomedRef.current = true;
  }, [setScale, scale]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(scale / 1.1, 0.25);  // 10% decrement, min 0.25x
    setScale(newScale, 'USER_ZOOM_OUT');
    setZoomMode('manual');
    hasUserZoomedRef.current = true;
  }, [setScale, scale]);

  const handleFitWidth = useCallback(() => {
    const newScale = computeFitWidthScale(basePageWidth, viewerWidth);
    if (DEBUG) {
      console.log('[handleFitWidth] Computing:', { basePageWidth, viewerWidth, newScale });
    }
    setScale(newScale, 'FIT_WIDTH_BUTTON');
    setZoomMode('fitWidth');
    // Reset user zoomed flag so auto-fit can work on resize
    hasUserZoomedRef.current = false;
    // Scroll to top-left when fitting width
    if (containerRef.current) {
      containerRef.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    }
  }, [basePageWidth, viewerWidth, computeFitWidthScale, setScale]);

  const handleFitSelection = useCallback(() => {
    fitSelection(undefined, 'FIT_SELECTION_BUTTON');
    setZoomMode('fitSelection');
    hasUserZoomedRef.current = true;
  }, [fitSelection]);

  const hasSelection = currentRegion && currentRegion.width > 0 && currentRegion.height > 0;

  const getCursor = () => {
    if (addGuideMode && hasSelection) return 'crosshair';
    if (showColumnGuides) return 'pointer';
    if (manualDrawMode) return 'crosshair';
    if (drawMode === 'drawing') return 'crosshair';
    if (drawMode === 'moving') return 'move';
    if (drawMode === 'resizing') {
      if (activeHandle === 'nw' || activeHandle === 'se') return 'nwse-resize';
      if (activeHandle === 'ne' || activeHandle === 'sw') return 'nesw-resize';
    }
    return 'default';
  };

  const selectionAreaNorm = selectionNorm
    ? (selectionNorm.x1 - selectionNorm.x0) * (selectionNorm.y1 - selectionNorm.y0)
    : 0;
  const isSelectionTooLarge = selectionAreaNorm > 0.7;

  // Column guides are available when there's a selection, callback is provided, and parent wants them shown
  const showColumnGuides = hasSelection && !!onColumnGuidesChange && showColumnGuidesFromParent;

  const hasPdfUrl = !!pdfUrl;

  return (
    <div className="flex flex-col lg:flex-row gap-2 h-full relative overflow-hidden">
      {/* Main PDF viewer */}
      <div className={`flex-1 min-w-0 min-h-0 flex flex-col transition-all duration-300 ${controlsOpen ? '' : 'lg:mr-0'}`}>
        {/* Viewer container - fills available space */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 relative bg-gray-100 rounded-lg overflow-auto select-none"
          style={{
            cursor: getCursor(),
          }}
        >
          {!hasPdfUrl && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-16 h-16 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-lg font-medium text-gray-700 mb-2">No sample document found</p>
              <p className="text-sm text-gray-500 text-center max-w-md">
                Please go back and re-upload files or select a different group.
              </p>
            </div>
          )}

          {hasPdfUrl && (
            <div className="min-h-full flex justify-center items-start p-2">
              <div
                ref={pageWrapperRef}
                className="relative inline-block"
                style={enhanceReadability ? { filter: 'contrast(1.15) brightness(1.02)' } : undefined}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={(showColumnGuides || addGuideMode) ? handleAddColumnGuide : undefined}
              >
                <Document
                  file={pdfUrl}
                  onLoadSuccess={({ numPages: pages }) => {
                    setNumPages(pages);
                    setPdfLoaded(true);
                    setPdfError(null);
                  }}
                  onLoadError={(error) => {
                    setPdfLoaded(false);
                    setPdfError(error?.message || 'Failed to load PDF');
                  }}
                  loading={
                    <div className="flex items-center justify-center h-[300px] w-[300px] bg-white shadow rounded text-gray-500">
                      <svg className="animate-spin h-8 w-8 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading PDF...
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center justify-center h-[300px] w-[300px] bg-white shadow rounded text-gray-500 p-6">
                      <svg className="w-12 h-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-lg font-medium text-gray-700 mb-2">Failed to load PDF</p>
                      <p className="text-sm text-gray-500 text-center mb-4">
                        {pdfError || 'The document could not be loaded.'}
                      </p>
                      {onReuploadRequest && (
                        <button
                          onClick={onReuploadRequest}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          Re-upload Files
                        </button>
                      )}
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="shadow-lg"
                    onLoadSuccess={(page) => {
                      // Use originalWidth/originalHeight which are the base dimensions at scale=1
                      // The width/height properties are already scaled
                      const baseW = page.originalWidth || page.width;
                      const baseH = page.originalHeight || page.height;
                      if (DEBUG) {
                        console.log('[Page onLoadSuccess]', {
                          width: page.width,
                          height: page.height,
                          originalWidth: page.originalWidth,
                          originalHeight: page.originalHeight,
                          currentScale: scale,
                          computedBaseW: baseW,
                          computedBaseH: baseH,
                        });
                      }
                      setBasePageWidth(baseW);
                      setBasePageHeight(baseH);
                    }}
                  />
                </Document>

                {/* Selection overlay */}
                {pdfLoaded && currentRegion && currentRegion.width > 0 && (
                  <div
                    className={`absolute ${drawMode === 'drawing' ? 'border border-blue-400 bg-blue-100/20' : 'border border-blue-500 bg-blue-50/10'} ${isSelectionTooLarge ? 'border-amber-500' : ''}`}
                    style={{
                      left: currentRegion.x,
                      top: currentRegion.y,
                      width: currentRegion.width,
                      height: currentRegion.height,
                      // In column guides mode, let clicks through to parent onClick handler
                      // but keep pointer-events on children (resize handles, guide lines)
                      pointerEvents: showColumnGuides ? 'none' : (drawMode === 'none' ? 'auto' : 'none'),
                      boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    {drawMode === 'none' && (
                      <>
                        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize pointer-events-auto opacity-80 hover:opacity-100" />
                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize pointer-events-auto opacity-80 hover:opacity-100" />
                        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize pointer-events-auto opacity-80 hover:opacity-100" />
                        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize pointer-events-auto opacity-80 hover:opacity-100" />
                      </>
                    )}

                    {showColumnGuides &&
                      columnGuides.map((x, i) => {
                        const guideX = x * renderedPageWidth;
                        return (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 cursor-pointer group pointer-events-auto"
                          style={{ left: guideX - currentRegion.x }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onColumnGuidesChange) {
                              onColumnGuidesChange(columnGuides.filter((_, idx) => idx !== i));
                            }
                          }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Click to remove
                          </div>
                        </div>
                        );
                      })}
                  </div>
                )}

                {/* First-time tip - improved step guidance */}
                {pdfLoaded && showTip && !hasSelection && !manualDrawMode && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-gray-900/90 text-white px-6 py-5 rounded-xl max-w-md text-center shadow-xl">
                      <div className="flex items-center justify-center mb-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-lg font-bold">1</div>
                      </div>
                      <p className="font-semibold text-lg mb-2">Select the table</p>
                      <div className="space-y-2 text-sm text-gray-300">
                        <p className="flex items-center justify-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 bg-blue-600 rounded text-xs font-medium">Recommended</span>
                          Click <strong className="text-white">Auto-detect</strong> in the panel →
                        </p>
                        <p className="text-gray-400">or</p>
                        <p>Click <strong className="text-white">Draw manually</strong> to select yourself</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual draw mode indicator */}
                {pdfLoaded && manualDrawMode && !currentRegion && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-blue-600/90 text-white px-6 py-4 rounded-xl">
                      <p className="font-medium">Click and drag to draw a box around the table</p>
                    </div>
                  </div>
                )}

                {/* Column guide instruction - shows when in add guide mode */}
                {pdfLoaded && addGuideMode && currentRegion && (
                  <div className="absolute bottom-4 left-4 bg-green-600/90 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
                    <span className="font-medium">Add Guide Mode:</span> Click inside the selection to add a column guide
                  </div>
                )}

                {/* General column guide hint - shows when guides visible but not in add mode */}
                {pdfLoaded && showColumnGuides && !addGuideMode && columnGuides.length > 0 && currentRegion && (
                  <div className="absolute bottom-4 left-4 bg-gray-900/80 text-white px-4 py-2 rounded-lg text-sm">
                    Click a guide line to remove it
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Debug overlay toggle - only in dev mode */}
        {DEBUG && (
          <button
            onClick={() => setShowDebugOverlay(!showDebugOverlay)}
            className="absolute top-2 left-2 z-50 text-xs font-mono bg-black/60 text-white px-2 py-1 rounded hover:bg-black/80"
            title="Toggle debug info"
          >
            {showDebugOverlay ? '×' : 'D'}
          </button>
        )}

        {/* Debug overlay - shows zoom/fit state */}
        {DEBUG && showDebugOverlay && (
          <div className="absolute top-10 left-2 z-50 text-xs font-mono bg-black/90 text-green-400 px-3 py-2 rounded shadow-lg space-y-1">
            <div>Viewer: {viewerWidth}×{viewerHeight}</div>
            <div>Page@1: {Math.round(basePageWidth)}×{Math.round(basePageHeight)}</div>
            <div>Scale: {Math.round(scale * 100)}%</div>
            <div>Mode: <span className="text-yellow-400">{zoomMode}</span></div>
            <div>FitScale: {basePageWidth > 0 ? Math.round(((viewerWidth - 24) / basePageWidth) * 100) : 0}%</div>
            <div>Rendered: {Math.round(renderedPageWidth)}×{Math.round(renderedPageHeight)}</div>
            <div>DPR: {typeof window !== 'undefined' ? window.devicePixelRatio : 'N/A'}</div>
            <div>InitFit: {initialFitWidthDone ? 'done' : 'pending'}</div>
          </div>
        )}
      </div>

      {/* Desktop collapse button */}
      <button
        onClick={() => setControlsOpen(!controlsOpen)}
        className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-40 w-6 h-16 items-center justify-center bg-white border border-gray-200 rounded-l-lg shadow-sm hover:bg-gray-50 transition-all ${
          controlsOpen ? 'right-[260px]' : 'right-0'
        }`}
        title={controlsOpen ? 'Collapse controls' : 'Expand controls'}
      >
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${controlsOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Controls panel - narrower (260px) and properly collapsible on desktop */}
      <div
        className={`fixed lg:relative inset-y-0 right-0 z-30 w-[260px] shrink-0 bg-white border-l border-gray-200 lg:border lg:rounded-lg transform transition-all duration-300 ease-in-out ${
          controlsOpen ? 'translate-x-0 lg:w-[260px]' : 'translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden lg:border-0'
        } overflow-y-auto lg:max-h-full`}
      >
        {/* Mobile drawer header */}
        <div className="lg:hidden sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <span className="font-medium text-gray-900">Controls</span>
          <button onClick={() => setControlsOpen(false)} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Detection */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900 text-sm">Detection</h3>
            <button
              onClick={onAutoDetect}
              disabled={isDetecting || isSnapping}
              className={`w-full flex items-center justify-center px-4 py-2.5 rounded-lg font-medium text-sm ${isDetecting || isSnapping ? 'bg-gray-200 text-gray-400 cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {isDetecting || isSnapping ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isSnapping ? 'Snapping...' : 'Detecting...'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Auto-detect table
                </>
              )}
            </button>

            {onAutoSnapToggle && (
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Auto-snap after detection</span>
                <div className="relative">
                  <input type="checkbox" checked={autoSnapEnabled} onChange={(e) => onAutoSnapToggle(e.target.checked)} className="sr-only" />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${autoSnapEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${autoSnapEnabled ? 'translate-x-4' : ''}`}></div>
                </div>
              </label>
            )}

            <div className="border-t border-gray-100 pt-3">
              <button
                onClick={() => { setManualDrawMode(true); setCurrentRegion(null); setShowTip(false); }}
                className={`w-full flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium ${manualDrawMode ? 'bg-gray-200 text-gray-700' : 'border border-gray-300 text-gray-600 hover:bg-gray-100'}`}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                </svg>
                Draw manually
              </button>
            </div>
          </div>

          {/* View controls */}
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <h3 className="font-medium text-gray-900 text-sm">View</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Zoom</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  zoomMode === 'fitWidth' ? 'bg-green-100 text-green-700' :
                  zoomMode === 'fitSelection' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {zoomMode === 'fitWidth' ? 'W' : zoomMode === 'fitSelection' ? 'S' : 'M'}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-gray-100" title="Zoom out (sets manual mode)">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-sm text-gray-700 min-w-[50px] text-center font-medium">
                  {Math.round(scale * 100)}%
                </span>
                <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-gray-100" title="Zoom in (sets manual mode)">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleFitWidth}
                className={`flex-1 px-2 py-1.5 text-xs rounded font-medium ${
                  zoomMode === 'fitWidth' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Fit width
              </button>
              <button
                onClick={handleFitSelection}
                disabled={!hasSelection}
                className={`flex-1 px-2 py-1.5 text-xs rounded font-medium ${
                  !hasSelection ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                  zoomMode === 'fitSelection' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
                title={hasSelection ? 'Zoom to selected table' : 'Select a table first'}
              >
                Fit selection
              </button>
            </div>

            <label className="flex items-center justify-between cursor-pointer pt-1">
              <span className="text-sm text-gray-700">Enhance readability</span>
              <div className="relative">
                <input type="checkbox" checked={enhanceReadability} onChange={(e) => setEnhanceReadability(e.target.checked)} className="sr-only" />
                <div className={`block w-10 h-6 rounded-full transition-colors ${enhanceReadability ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${enhanceReadability ? 'translate-x-4' : ''}`}></div>
              </div>
            </label>

            {numPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-sm text-gray-600">Page</span>
                <div className="flex items-center space-x-2">
                  <button onClick={() => setPageNumber((p) => Math.max(p - 1, 1))} disabled={pageNumber <= 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-sm text-gray-700 font-medium">{pageNumber} / {numPages}</span>
                  <button onClick={() => setPageNumber((p) => Math.min(p + 1, numPages))} disabled={pageNumber >= numPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {candidates.length > 1 && (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <h3 className="font-medium text-gray-900 text-sm">Suggestions</h3>
              <div className="flex flex-wrap gap-2">
                {candidates.map((candidate, index) => (
                  <div key={index} className="relative">
                    <button
                      onClick={() => handleSelectCandidate(index)}
                      onMouseEnter={() => setHoveredCandidateIndex(index)}
                      onMouseLeave={() => setHoveredCandidateIndex(null)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCandidateIndex === index ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {index === 0 ? 'Best' : `Option ${index + 1}`}
                    </button>
                    {hoveredCandidateIndex === index && (
                      <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
                        <div className="font-medium mb-1">
                          {candidate.score !== undefined && <span>Confidence: {Math.round(candidate.score * 100)}%</span>}
                        </div>
                        <div className="text-gray-300 text-xs">
                          {candidate.confidence_label || candidate.reason || 'Table region detected'}
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selection status */}
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <h3 className="font-medium text-gray-900 text-sm">Selection</h3>
            {hasSelection ? (
              <div className="space-y-3">
                <div className={`flex items-center text-sm ${isSelectionTooLarge ? 'text-amber-600' : 'text-green-600'}`}>
                  {isSelectionTooLarge ? (
                    <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {isSelectionTooLarge ? 'Selection may be too large' : 'Table selected'}
                </div>

                {gridEstimate && (
                  <p className="text-xs text-gray-500">~{gridEstimate.approxCols} columns, ~{gridEstimate.approxRows} rows</p>
                )}

                {confidenceLevel && !isSelectionTooLarge && (
                  <div className={`rounded-lg px-3 py-2 text-xs ${confidenceLevel === 'good' ? 'bg-green-50 text-green-700' : confidenceLevel === 'suspicious' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                    <div className="font-medium">
                      {confidenceLevel === 'good' ? 'Good detection' : confidenceLevel === 'suspicious' ? 'May need adjustment' : 'Likely incorrect'}
                    </div>
                    {confidenceDetails?.reason && <p className="mt-0.5 opacity-80">{confidenceDetails.reason}</p>}
                  </div>
                )}

                {isSelectionTooLarge && (
                  <div className="rounded-lg px-3 py-2 bg-amber-50 text-amber-700 text-xs">
                    <div className="font-medium">Selection too large</div>
                    <p className="mt-0.5 opacity-80">May include margins or non-table content.</p>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                  {onSnapTighter && (
                    <button onClick={onSnapTighter} disabled={isSnapping} className="flex items-center justify-center px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium disabled:opacity-50">
                      {isSnapping ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Snapping...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                          Snap tighter
                        </>
                      )}
                    </button>
                  )}
                  <button onClick={handleClearSelection} className="flex items-center justify-center px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium">
                    Clear selection
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No table selected yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile controls toggle button */}
      {!controlsOpen && (
        <button
          onClick={() => setControlsOpen(true)}
          className="lg:hidden fixed bottom-4 right-4 z-30 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center"
          title="Open controls"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>
      )}

      {/* Mobile overlay */}
      {controlsOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setControlsOpen(false)} />
      )}

    </div>
  );
});

SetupCanvas.displayName = 'SetupCanvas';

export default SetupCanvas;
