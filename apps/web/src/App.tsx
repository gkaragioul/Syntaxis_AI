import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import TemplateBuilder from './pages/TemplateBuilder'
import BatchRun from './pages/BatchRun'

function App() {
  // Authentication disabled for testing
  
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" />} />
      <Route
        path="/dashboard"
        element={<Dashboard />}
      />
      <Route
        path="/template/new"
        element={<TemplateBuilder />}
      />
      <Route
        path="/template/:id"
        element={<TemplateBuilder />}
      />
      <Route
        path="/batch/run"
        element={<BatchRun />}
      />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default App
