import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white dark:bg-[#0C0C0F] flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-2xl font-bold text-brand-blue dark:text-white mb-4">Something went wrong</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
            An unexpected error occurred. We've logged the issue and are looking into it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-brand-blue text-white rounded-lg font-medium hover:bg-brand-blue/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
