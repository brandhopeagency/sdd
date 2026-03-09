import { Component, ReactNode } from 'react';
import i18next from 'i18next';
const i18n = i18next;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ReviewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Review] Error boundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const t = (key: string, fallback?: string) => i18n.t(key, { defaultValue: fallback });
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-neutral-800 mb-2">
            {t('review.errorBoundary.title', 'Something went wrong')}
          </h2>
          <p className="text-sm text-neutral-500 mb-4 max-w-md">
            {t('review.errorBoundary.description', 'An error occurred in the review module. Please try again.')}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
          >
            {t('review.errorBoundary.retry', 'Try Again')}
          </button>
          {this.state.error && (
            <pre className="mt-4 p-3 bg-neutral-100 rounded text-xs text-neutral-600 max-w-lg overflow-auto" role="alert">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
