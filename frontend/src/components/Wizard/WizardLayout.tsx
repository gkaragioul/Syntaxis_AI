import React from 'react';
import { WIZARD_STEP_LABELS, WizardStep } from '../../types/wizard';

interface WizardLayoutProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
  children: React.ReactNode;
}

const steps: WizardStep[] = [1, 2, 3, 4];

export const WizardLayout: React.FC<WizardLayoutProps> = ({
  currentStep,
  onStepClick,
  children,
}) => {
  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header with stepper - fixed height */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          {/* Stepper */}
          <nav aria-label="Progress">
            <ol className="flex items-center justify-center">
              {steps.map((step, stepIdx) => (
                <li
                  key={step}
                  className={`${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''} relative`}
                >
                  {/* Connector line */}
                  {stepIdx !== steps.length - 1 && (
                    <div
                      className="absolute top-4 left-8 -ml-px w-full h-0.5"
                      aria-hidden="true"
                    >
                      <div
                        className={`h-full ${
                          step < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      />
                    </div>
                  )}

                  {/* Step indicator */}
                  <button
                    onClick={() => step < currentStep && onStepClick?.(step)}
                    disabled={step > currentStep}
                    className={`
                      relative flex items-center justify-center group
                      ${step <= currentStep ? 'cursor-pointer' : 'cursor-default'}
                    `}
                  >
                    <span className="flex flex-col items-center">
                      {/* Circle */}
                      <span
                        className={`
                          w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium
                          transition-colors duration-200
                          ${
                            step < currentStep
                              ? 'bg-blue-600 text-white'
                              : step === currentStep
                              ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                              : 'bg-gray-200 text-gray-500'
                          }
                          ${step < currentStep ? 'hover:bg-blue-700' : ''}
                        `}
                      >
                        {step < currentStep ? (
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          step
                        )}
                      </span>

                      {/* Label */}
                      <span
                        className={`
                          mt-2 text-sm font-medium
                          ${
                            step <= currentStep
                              ? 'text-blue-600'
                              : 'text-gray-500'
                          }
                        `}
                      >
                        {WIZARD_STEP_LABELS[step]}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>

      {/* Main content - flex-1 to fill remaining space */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full w-full px-4 py-2">
          {children}
        </div>
      </main>
    </div>
  );
};

export default WizardLayout;
