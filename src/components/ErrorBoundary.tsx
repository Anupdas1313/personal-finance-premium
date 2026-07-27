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
    
    // Check if it's a Vite dynamic import / PWA chunk load error
    const isChunkError = 
      error.name === 'ChunkLoadError' || 
      error.message.includes('dynamically imported module') || 
      error.message.includes('Failed to fetch dynamically imported module');
      
    if (isChunkError) {
      console.log('Detected ChunkLoadError. Unregistering service workers and reloading...');
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
          setTimeout(() => window.location.reload(), 500);
        }).catch(() => {
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white dark:bg-[#0C0C0F] flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-2xl font-bold text-brand-blue dark:text-white mb-4">Something went wrong</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md break-words">
            {this.state.error?.message || "An unexpected error occurred. We've logged the issue and are looking into it."}
          </p>
          <button
            onClick={() => {
              // On manual try again, unregister SW just in case it's a stubborn cache issue
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                  for (const registration of registrations) {
                    registration.unregister();
                  }
                  window.location.reload();
                });
              } else {
                window.location.reload();
              }
            }}
            className="px-6 py-2 bg-brand-blue text-white rounded-lg font-medium hover:bg-brand-blue/90 transition-colors"
          >
            Force Reload & Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
