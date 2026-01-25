import React from 'react';
import ErrorDisplay from './ErrorDisplay';
import { ErrorCode } from '../types/errors';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to your error reporting service
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          error={{
            code: ErrorCode.UNKNOWN_ERROR,
            userMessage: 'Something went wrong in the application.',
            nextSteps: 'Please try refreshing the page. If the problem persists, contact support.',
            helpUrl: '/help/application-errors',
            logId: this.state.error?.name,
          }}
          onRetry={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 