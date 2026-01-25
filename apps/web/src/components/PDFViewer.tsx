import { useState, useEffect, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { documentAPI } from '../api'
import { bboxToRect, normalizeRect, Point } from '../utils/canvas'

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`

interface PDFViewerProps {
  documentId: number
  detectedRegions: any
  onRegionSelect: (region: any, pageNum: number) => void
  selectedRegions: any[]
}

export default function PDFViewer({
  documentId,
  detectedRegions,
  onRegionSelect,
  selectedRegions,
}: PDFViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<Point | null>(null)
  const [currentDrawRect, setCurrentDrawRect] = useState<Point | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Load PDF Document
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true)
        const fileResponse = await documentAPI.downloadRaw(documentId)
        const loadingTask = pdfjsLib.getDocument(URL.createObjectURL(fileResponse.data))
        const doc = await loadingTask.promise
        setPdfDoc(doc)
        setLoading(false)
      } catch (error) {
        console.error('Error loading PDF:', error)
        setLoading(false)
      }
    }

    if (documentId) {
      loadPdf()
    }
  }, [documentId])

  // Render Page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !overlayRef.current) return

    try {
      const page = await pdfDoc.getPage(currentPage + 1)
      const viewport = page.getViewport({ scale: scale * 1.5 }) // Slightly larger base scale for quality
      
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) return

      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = '100%'
      canvas.style.height = 'auto'

      overlayRef.current.width = viewport.width
      overlayRef.current.height = viewport.height
      overlayRef.current.style.width = '100%'
      overlayRef.current.style.height = 'auto'

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise

      drawOverlay()
    } catch (error) {
      console.error('Error rendering page:', error)
    }
  }, [pdfDoc, currentPage, scale])

  // Draw Overlay
  const drawOverlay = useCallback(() => {
    if (!overlayRef.current) return
    const ctx = overlayRef.current.getContext('2d')
    if (!ctx) return

    const width = overlayRef.current.width
    const height = overlayRef.current.height
    ctx.clearRect(0, 0, width, height)

    const internalScale = scale * 1.5

    // Draw detected regions (Subtle Blue)
    const pageDetected = detectedRegions[currentPage] || []
    ctx.strokeStyle = 'rgba(0, 113, 227, 0.4)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    
    pageDetected.forEach((region: any) => {
      const rect = bboxToRect(region, internalScale)
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
      ctx.fillStyle = 'rgba(0, 113, 227, 0.03)'
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    })

    // Draw selected regions (Apple Blue accent)
    ctx.setLineDash([])
    ctx.strokeStyle = '#0071e3'
    ctx.lineWidth = 3
    
    selectedRegions.forEach((region: any) => {
      if (region.page === currentPage) {
        const rect = bboxToRect(region.bbox, internalScale)
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
        ctx.fillStyle = 'rgba(0, 113, 227, 0.1)'
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
        
        // Corner handles effect
        ctx.fillStyle = 'white'
        const handleSize = 6
        ctx.fillRect(rect.x - handleSize/2, rect.y - handleSize/2, handleSize, handleSize)
        ctx.strokeRect(rect.x - handleSize/2, rect.y - handleSize/2, handleSize, handleSize)
      }
    })

    // Current drag
    if (isDrawing && drawStart && currentDrawRect) {
      const bbox = normalizeRect(drawStart, currentDrawRect)
      ctx.strokeStyle = '#0071e3'
      ctx.lineWidth = 2
      ctx.strokeRect(bbox.x0, bbox.y0, bbox.x1 - bbox.x0, bbox.y1 - bbox.y0)
      ctx.fillStyle = 'rgba(0, 113, 227, 0.05)'
      ctx.fillRect(bbox.x0, bbox.y0, bbox.x1 - bbox.x0, bbox.y1 - bbox.y0)
    }
  }, [currentPage, detectedRegions, selectedRegions, isDrawing, drawStart, currentDrawRect, scale])

  useEffect(() => { renderPage() }, [renderPage])
  useEffect(() => { drawOverlay() }, [drawOverlay])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (overlayRef.current!.width / rect.width)
    const y = (e.clientY - rect.top) * (overlayRef.current!.height / rect.height)
    setIsDrawing(true)
    setDrawStart({ x, y })
    setCurrentDrawRect({ x, y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const rect = overlayRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (overlayRef.current!.width / rect.width)
    const y = (e.clientY - rect.top) * (overlayRef.current!.height / rect.height)
    setCurrentDrawRect({ x, y })
  }

  const handleMouseUp = () => {
    if (!isDrawing || !drawStart || !currentDrawRect) return
    setIsDrawing(false)
    const rawBBox = normalizeRect(drawStart, currentDrawRect)
    if (rawBBox.x1 - rawBBox.x0 < 10 || rawBBox.y1 - rawBBox.y0 < 10) return

    const internalScale = scale * 1.5
    onRegionSelect({ 
      x0: rawBBox.x0 / internalScale, 
      y0: rawBBox.y0 / internalScale, 
      x1: rawBBox.x1 / internalScale, 
      y1: rawBBox.y1 / internalScale 
    }, currentPage)
    setDrawStart(null)
    setCurrentDrawRect(null)
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-[#e8e8ed]">
      {/* Floating Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 glass-morphism rounded-full px-4 py-2 flex items-center gap-4 shadow-2xl border border-white/20">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center disabled:opacity-20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span className="text-sm font-medium tabular-nums min-w-[60px] text-center">
            {currentPage + 1} / {pdfDoc?.numPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min((pdfDoc?.numPages || 1) - 1, currentPage + 1))}
            disabled={!pdfDoc || currentPage >= pdfDoc.numPages - 1}
            className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center disabled:opacity-20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        
        <div className="h-4 w-[1px] bg-black/10"></div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="text-lg font-light w-6 h-6 flex items-center justify-center hover:bg-black/5 rounded-full">-</button>
          <span className="text-[11px] font-bold text-secondary w-10 text-center uppercase tracking-tighter">{(scale * 100).toFixed(0)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="text-lg font-light w-6 h-6 flex items-center justify-center hover:bg-black/5 rounded-full">+</button>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-12 flex justify-center scrollbar-hide"
      >
        <div className="relative shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-sm overflow-hidden bg-white h-fit">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-50">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <canvas ref={canvasRef} className="block" />
          <canvas 
            ref={overlayRef}
            className="absolute top-0 left-0 cursor-crosshair touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>
    </div>
  )
}

