import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an uncaught component error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] w-full items-center justify-center p-6 text-slate-100">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-rose-500/30 bg-[#0e121b]/95 p-8 shadow-2xl backdrop-blur-2xl text-center">
            <div className="pointer-events-none absolute -top-12 -left-12 h-36 w-36 rounded-full bg-rose-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -right-12 h-36 w-36 rounded-full bg-indigo-500/15 blur-3xl" />

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/10 text-rose-400 mb-5 shadow-lg shadow-rose-500/10">
              <AlertCircle className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              {this.props.fallbackMessage || "An unexpected error occurred."}
            </h2>

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              An unexpected error occurred while rendering this view. Your session and credentials remain completely active.
            </p>

            {this.state.error && (
              <div className="mt-4 p-3 bg-black/60 rounded-xl text-left font-mono text-[11px] text-rose-300 overflow-x-auto border border-rose-500/20 max-h-48">
                <div className="font-bold text-rose-400">
                  {String(this.state.error.name)}: {String(this.state.error.message)}
                </div>
                {this.state.error.stack && (
                  <pre className="mt-1 text-[10px] text-slate-400 whitespace-pre-wrap">
                    {String(this.state.error.stack)}
                  </pre>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={this.handleReset}
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retry & Reload View</span>
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  window.location.href = "/student/dashboard";
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 border-white/10 text-slate-300 hover:text-white"
              >
                <Home className="h-4 w-4" />
                <span>Go to Dashboard</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
