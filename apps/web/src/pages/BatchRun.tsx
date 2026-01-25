import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { templateAPI, documentAPI, batchAPI } from '../api'

export default function BatchRun() {
  const navigate = useNavigate()
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [batchJobId, setBatchJobId] = useState<number | null>(null)
  const [batchStatus, setBatchStatus] = useState<any>(null)
  
  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await templateAPI.list()
      return response.data
    },
  })
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true)
    
    const uploadPromises = acceptedFiles.map(async (file) => {
      try {
        const response = await documentAPI.upload(file)
        return response.data
      } catch (error) {
        console.error(`Failed to upload ${file.name}`, error)
        return null
      }
    })
    
    const results = await Promise.all(uploadPromises)
    const successfulUploads = results.filter((r) => r !== null)
    
    setUploadedDocuments([...uploadedDocuments, ...successfulUploads])
    setUploading(false)
  }, [uploadedDocuments])
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 50 * 1024 * 1024,
  })
  
  const handleRunBatch = async () => {
    if (!selectedTemplateId) {
      alert('Please select a template')
      return
    }
    
    if (uploadedDocuments.length === 0) {
      alert('Please upload at least one document')
      return
    }
    
    try {
      const documentIds = uploadedDocuments.map((doc) => doc.document_id)
      const response = await batchAPI.create(selectedTemplateId, documentIds)
      setBatchJobId(response.data.batch_job_id)
      
      startPolling(response.data.batch_job_id)
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to start batch job')
    }
  }
  
  const startPolling = (jobId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await batchAPI.getStatus(jobId)
        setBatchStatus(response.data)
        
        if (response.data.status === 'DONE' || response.data.status === 'FAILED') {
          clearInterval(interval)
        }
      } catch (error) {
        clearInterval(interval)
      }
    }, 2000)
  }
  
  const handleDownload = async () => {
    if (!batchJobId) return
    
    try {
      const response = await batchAPI.download(batchJobId)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `batch_${batchJobId}_results.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Download failed')
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold">Batch Extraction</h1>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Select Template</h2>
            
            {isLoading ? (
              <p>Loading templates...</p>
            ) : templates && templates.length > 0 ? (
              <select
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(parseInt(e.target.value))}
                className="block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border"
              >
                <option value="">Choose a template...</option>
                {templates.map((template: any) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-gray-500">
                No templates available. Create a template first.
              </p>
            )}
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Upload Documents</h2>
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer mb-4 ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
            >
              <input {...getInputProps()} />
              <p className="text-gray-600">
                {uploading
                  ? 'Uploading...'
                  : isDragActive
                  ? 'Drop PDFs here'
                  : 'Drag & drop PDFs here, or click to select (up to 200)'}
              </p>
            </div>
            
            {uploadedDocuments.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">
                  Uploaded Documents ({uploadedDocuments.length})
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {uploadedDocuments.map((doc, idx) => (
                    <div key={idx} className="text-sm text-gray-600 flex justify-between">
                      <span>{doc.filename}</span>
                      <span className="text-xs text-gray-500">{doc.page_count} pages</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <button
              onClick={handleRunBatch}
              disabled={!selectedTemplateId || uploadedDocuments.length === 0 || !!batchJobId}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              Run Batch Extraction
            </button>
          </div>
          
          {batchStatus && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Batch Status</h2>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Status:{' '}
                  <span className={`font-semibold ${
                    batchStatus.status === 'DONE' ? 'text-green-600' :
                    batchStatus.status === 'FAILED' ? 'text-red-600' :
                    'text-blue-600'
                  }`}>
                    {batchStatus.status}
                  </span>
                </p>
              </div>
              
              <div className="space-y-2 mb-4">
                {batchStatus.items.map((item: any, idx: number) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Document {item.document_id}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        item.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                        item.status === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
                        item.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status || 'PENDING'}
                      </span>
                    </div>
                    {item.warnings && (
                      <p className="text-xs text-yellow-600 mt-1">
                        {JSON.stringify(item.warnings)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              
              {batchStatus.status === 'DONE' && (
                <button
                  onClick={handleDownload}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  Download Results (ZIP)
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
