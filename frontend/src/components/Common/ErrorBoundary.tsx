import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <pre style={{ color: 'red', whiteSpace: 'pre-wrap' }}>{this.state.message}</pre>
          <button onClick={() => this.setState({ hasError: false, message: '' })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
