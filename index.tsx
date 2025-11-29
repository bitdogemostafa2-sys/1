import React, { Component, ReactNode, ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AlertCircle, Trash2, RefreshCw } from 'lucide-react';

// Define explicit interfaces for Props and State
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary Component to catch crashes
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical App Crash:", error, errorInfo);
  }

  handleHardReset = () => {
    if (window.confirm("هل أنت متأكد؟ سيتم حذف جميع البيانات المحلية لإصلاح البرنامج.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center font-sans" dir="rtl">
          <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-3xl max-w-lg">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-4">عذراً، حدث خطأ غير متوقع!</h1>
            <p className="text-slate-300 mb-6">
              يبدو أن هناك بيانات تالفة تسببت في توقف البرنامج. لا تقلق، يمكنك إصلاح هذا.
            </p>
            
            <div className="bg-slate-900 p-4 rounded-xl mb-6 text-left overflow-auto max-h-32 border border-slate-800">
                <code className="text-red-400 text-xs font-mono">{this.state.error?.toString()}</code>
            </div>

            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => window.location.reload()}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> إعادة المحاولة
              </button>
              
              <button 
                onClick={this.handleHardReset}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-red-900/20"
              >
                <Trash2 className="w-4 h-4" /> إصلاح النظام (Reset)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);