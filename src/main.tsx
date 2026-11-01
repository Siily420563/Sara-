import React, { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in application UI:", error, errorInfo);
  }

  public render() {
    const state = (this as any).state as ErrorBoundaryState;
    if (state?.hasError) {
      return (
        <div className="min-h-screen bg-[#060B14] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 text-xl font-bold">
            ⚠️
          </div>
          <h1 className="text-lg font-bold mb-1">Display Error Recovered</h1>
          <p className="text-xs text-gray-400 max-w-sm mb-5 leading-relaxed">
            {state.error?.message || "An error occurred while displaying message content."}
          </p>
          <button
            onClick={() => {
              (this as any).setState({ hasError: false });
              window.location.reload();
            }}
            className="px-4 py-2 rounded-xl bg-[#0D62A6] hover:bg-[#1272BE] text-white text-xs font-semibold transition-all shadow-md"
          >
            Refresh View
          </button>
        </div>
      );
    }

    return (this as any).props?.children || null;
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('/push-sw.js', { scope: '/' }).then((reg) => {
        console.log('Push SW registered successfully:', reg.scope);
      }).catch((err) => {
        console.warn('Push SW registration rejected:', err);
      });
    } catch (err) {
      console.warn('Push SW registration failed:', err);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
