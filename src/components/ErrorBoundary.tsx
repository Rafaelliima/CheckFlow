import React from 'react';
import { addDebugLog } from '../lib/debug';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    addDebugLog('error', 'ErrorBoundary capturou um erro', {
      message: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-slate-900">Algo deu errado</h1>
            <p className="mt-2 text-sm text-slate-600">
              Abra com <code>?debug=true</code> para ver os logs de diagnóstico.
            </p>
            {this.state.errorMessage && (
              <p className="mt-3 text-xs text-rose-600">{this.state.errorMessage}</p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
