import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { templateAPI } from '../api'

export default function Dashboard() {
  const navigate = useNavigate()
  
  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await templateAPI.list()
      return response.data
    },
  })
  
  return (
    <div className="min-h-screen bg-[#f5f5f7] selection:bg-blue-100">
      {/* Navigation */}
      <nav className="glass-morphism sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
          <h1 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">Syntaxis AI</h1>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-sm font-medium text-[#1d1d1f] hover:text-blue-600 transition-colors">Documentation</button>
          <button className="text-sm font-medium text-[#1d1d1f] hover:text-blue-600 transition-colors">Settings</button>
          <div className="h-4 w-[1px] bg-black/10"></div>
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">GK</div>
        </div>
      </nav>
      
      <main className="max-w-5xl mx-auto py-12 px-6">
        {/* Hero Section */}
        <section className="mb-16">
          <h2 className="text-4xl font-bold tracking-tight mb-4">Your Templates</h2>
          <p className="text-lg text-secondary max-w-2xl">
            Streamline your data extraction workflow. Create and manage custom templates for automated PDF table processing.
          </p>
          
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => navigate('/template/new')}
              className="apple-button-primary shadow-lg shadow-blue-500/20"
            >
              + Create New Template
            </button>
            <button
              onClick={() => navigate('/batch/run')}
              className="px-6 py-2 rounded-full border border-black/10 bg-white font-medium hover:bg-gray-50 transition-colors"
            >
              Run Batch Extraction
            </button>
          </div>
        </section>
        
        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="apple-card h-48 animate-pulse bg-gray-50"></div>
            ))
          ) : templates && templates.length > 0 ? (
            templates.map((template: any) => (
              <div
                key={template.id}
                className="apple-card group p-6 flex flex-col justify-between h-56 cursor-pointer"
                onClick={() => navigate(`/template/${template.id}`)}
              >
                <div>
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                    <svg className="w-6 h-6 text-blue-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{template.name}</h3>
                  <p className="text-sm text-secondary line-clamp-2">
                    {template.description || 'No description provided.'}
                  </p>
                </div>
                
                <div className="flex justify-between items-center mt-4">
                  <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                    MODIFIED {new Date(template.created_at).toLocaleDateString()}
                  </span>
                  <div className="w-8 h-8 rounded-full border border-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-black/5">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-gray-900">No templates yet</h3>
              <p className="mt-1 text-gray-500">Get started by creating your first extraction template.</p>
              <button 
                onClick={() => navigate('/template/new')}
                className="mt-6 text-blue-600 font-semibold hover:underline"
              >
                Create Template →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

