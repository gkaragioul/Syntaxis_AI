import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { documentAPI, templateAPI, previewAPI } from '../api'
import PDFViewer from '../components/PDFViewer'

export default function TemplateBuilder() {
  const navigate = useNavigate()
  const [documentId, setDocumentId] = useState<number | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [detectedRegions, setDetectedRegions] = useState<any>({})
  const [selectedRegions, setSelectedRegions] = useState<any[]>([])
  const [headerDepth, setHeaderDepth] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    const file = acceptedFiles[0]
    setUploading(true)
    try {
      const response = await documentAPI.upload(file)
      setDocumentId(response.data.document_id)
      const detectResponse = await documentAPI.detectTables(response.data.document_id)
      setDetectedRegions(detectResponse.data.regions)
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  })
  
  const handleRegionSelect = (region: any, pageNum: number) => {
    setSelectedRegions([
      ...selectedRegions,
      {
        page: pageNum,
        bbox: {
          x0: region.x0,
          y0: region.y0,
          x1: region.x1,
          y1: region.y1,
        },
      },
    ])
  }
  
  const handlePreview = async () => {
    if (!documentId || selectedRegions.length === 0) return
    const templateSchema = {
      version: '1.0',
      tables: [{
        id: 'main_table',
        pages: 'all',
        region: { mode: 'absolute', bbox: selectedRegions[0].bbox },
        header: { depthRows: headerDepth, repeatEachPage: false },
        columns: { mode: 'auto' },
        cleanup: { dropEmptyRows: true, dropTotalsRows: false },
        mergedCells: { mode: 'preserve' },
        output: { sheetName: 'Sheet1', normalizeNumbers: true, keepCurrencySymbols: false },
      }],
      driftDetection: { maxAnchorDistancePx: 50, failOnDrift: false },
    }
    
    try {
      const response = await previewAPI.preview(documentId, templateSchema)
      setPreviewData(response.data)
      setShowPreview(true)
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Preview failed')
    }
  }
  
  const handleSaveTemplate = async () => {
    if (!templateName || selectedRegions.length === 0) return
    const templateSchema = {
      version: '1.0',
      tables: [{
        id: 'main_table',
        pages: 'all',
        region: { mode: 'absolute', bbox: selectedRegions[0].bbox },
        header: { depthRows: headerDepth, repeatEachPage: false },
        columns: { mode: 'auto' },
        cleanup: { dropEmptyRows: true, dropTotalsRows: false },
        mergedCells: { mode: 'preserve' },
        output: { sheetName: 'Sheet1', normalizeNumbers: true, keepCurrencySymbols: false },
      }],
      driftDetection: { maxAnchorDistancePx: 50, failOnDrift: false },
    }
    
    try {
      await templateAPI.create(templateName, templateDescription, templateSchema)
      navigate('/dashboard')
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to save template')
    }
  }
  
  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col">
      {/* Header */}
      <nav className="glass-morphism h-16 px-6 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">Template Builder</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={!documentId || selectedRegions.length === 0}
            className="px-4 py-1.5 rounded-full text-sm font-medium border border-black/10 hover:bg-white transition-colors disabled:opacity-30"
          >
            Preview
          </button>
          <button
            onClick={handleSaveTemplate}
            disabled={!documentId || selectedRegions.length === 0 || !templateName}
            className="apple-button-primary text-sm disabled:opacity-50"
          >
            Save Template
          </button>
        </div>
      </nav>
      
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Controls */}
        <div className="w-80 glass-morphism border-t-0 p-6 space-y-8 overflow-y-auto">
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Identity</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[13px] font-medium px-1">Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="apple-input w-full"
                  placeholder="Template title..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-[13px] font-medium px-1">Description</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="apple-input w-full h-20 resize-none"
                  placeholder="What is this for?"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Structure</h2>
            <div className="space-y-4 text-[13px]">
              <div className="flex justify-between items-center py-2 border-b border-black/5">
                <span>Header Depth</span>
                <input
                  type="number"
                  value={headerDepth}
                  onChange={(e) => setHeaderDepth(parseInt(e.target.value) || 0)}
                  className="w-12 text-right bg-transparent outline-none focus:text-blue-600 font-medium"
                />
              </div>
              <div className="flex justify-between py-2 border-b border-black/5">
                <span>Selected Regions</span>
                <span className="font-medium text-blue-600">{selectedRegions.length}</span>
              </div>
            </div>
          </section>

          {showPreview && previewData && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Preview</h2>
              <div className="bg-white rounded-xl shadow-sm border border-black/5 p-4 max-h-60 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <tbody>
                    {previewData.grid_data.slice(0, 10).map((row: any[], i: number) => (
                      <tr key={i} className={`border-b border-gray-50 ${i < headerDepth ? 'bg-gray-50/50 font-semibold' : ''}`}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="py-1 px-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Center: PDF Viewer */}
        <div className="flex-1 overflow-hidden p-8 flex justify-center bg-gray-200/50">
          {!documentId ? (
            <div
              {...getRootProps()}
              className={`w-full max-w-2xl aspect-[3/4] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all ${
                isDragActive ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' : 'border-black/10 bg-white'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">{uploading ? 'Processing Document...' : 'Upload PDF'}</p>
                <p className="text-secondary text-sm mt-1">Drag & drop or click to browse</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl bg-white animate-in zoom-in-95 duration-700">
              <PDFViewer
                documentId={documentId}
                detectedRegions={detectedRegions}
                onRegionSelect={handleRegionSelect}
                selectedRegions={selectedRegions}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

