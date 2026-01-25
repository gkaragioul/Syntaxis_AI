import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WizardProvider, useWizard } from '../contexts/WizardContext';
import {
  WizardLayout,
  UploadStep,
  GroupingStep,
  SetupStep,
  ExportStep,
} from '../components/Wizard';

const WizardContent: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const {
    session,
    currentStep,
    selectedGroupId,
    isLoading,
    error,
    showResumePrompt,
    initSession,
    continueSession,
    startFresh,
    goToStep,
  } = useWizard();

  // Initialize session on mount
  useEffect(() => {
    initSession();
  }, [initSession]);

  // Update URL when session changes
  useEffect(() => {
    if (session && !sessionId) {
      navigate(`/wizard/${session.id}`, { replace: true });
    }
  }, [session, sessionId, navigate]);

  // Loading state
  if (isLoading && !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <svg
              className="w-8 h-8 text-blue-600 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => initSession(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Resume prompt
  if (showResumePrompt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Resume where you left off?
          </h2>
          <p className="text-gray-600 mb-6">
            You have an incomplete session. Would you like to continue or start fresh?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={continueSession}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Continue
            </button>
            <button
              onClick={startFresh}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Determine which step content to show
  const renderStepContent = () => {
    // If a group is selected for setup, show setup step regardless of wizard state
    if (selectedGroupId) {
      return <SetupStep />;
    }

    switch (currentStep) {
      case 1:
        return <UploadStep />;
      case 2:
        return <GroupingStep />;
      case 3:
        return <SetupStep />;
      case 4:
        return <ExportStep />;
      default:
        return <UploadStep />;
    }
  };

  return (
    <WizardLayout currentStep={currentStep} onStepClick={goToStep}>
      {renderStepContent()}
    </WizardLayout>
  );
};

export const WizardPage: React.FC = () => {
  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
};

export default WizardPage;
