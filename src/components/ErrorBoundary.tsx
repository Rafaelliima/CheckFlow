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
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
          <div className="max-w-md rounded-2xl border border-rose-500/20 bg-slate-900/80 p-6 text-center shadow-2xl shadow-black/40 backdrop-blur-xl">
            <h1 className="text-lg font-semibold text-slate-100">Algo deu errado</h1>
            <p className="mt-2 text-sm text-slate-400">
              Abra com <code>?debug=true</code> para ver os logs de diagnóstico.
            </p>
            {this.state.errorMessage && (
              <p className="mt-3 text-xs text-rose-300">{this.state.errorMessage}</p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
