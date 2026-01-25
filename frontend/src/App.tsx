import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/Dashboard/DashboardLayout';
import { HelpCenter } from './pages/HelpCenter';
import { InvoiceList } from './pages/InvoiceList';
import { BatchDetailPage } from './pages/BatchDetailPage';
import { InboxPage } from './pages/InboxPage';
import { TemplateCreatePage } from './pages/TemplateCreatePage';
import { TemplatesPage } from './pages/TemplatesPage';
import { WizardPage } from './pages/WizardPage';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        {/* Wizard - primary entry point */}
        <Route path="/wizard" element={<WizardPage />} />
        <Route path="/wizard/:sessionId" element={<WizardPage />} />

        {/* Redirect home to wizard */}
        <Route path="/" element={<Navigate to="/wizard" replace />} />
        <Route path="/dashboard" element={<Navigate to="/wizard" replace />} />

        {/* Advanced/Legacy routes */}
        <Route path="/advanced/inbox" element={<InboxPage />} />
        <Route path="/advanced/batch/:id" element={<BatchDetailPage />} />
        {/* Keep old routes for backwards compatibility */}
        <Route path="/inbox" element={<Navigate to="/advanced/inbox" replace />} />
        <Route path="/batch/:id" element={<BatchDetailPage />} />

        {/* Documents - list all documents */}
        <Route path="/documents" element={<InvoiceList />} />

        {/* Templates */}
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/templates/new" element={<TemplateCreatePage />} />

        {/* Help */}
        <Route path="/help" element={
          <DashboardLayout><HelpCenter /></DashboardLayout>
        } />

        {/* Catch all - redirect to wizard */}
        <Route path="*" element={<Navigate to="/wizard" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
