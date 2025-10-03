"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches React errors in child components and displays a fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ERROR BOUNDARY] Caught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/40 flex items-center justify-center p-6">
          <Card className="max-w-2xl w-full shadow-lg border border-red-200/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-red-600">
                <AlertCircle className="h-6 w-6" />
                Something Went Wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <p className="text-slate-700">
                  The application encountered an unexpected error and cannot
                  continue. Please try one of the options below.
                </p>

                {this.state.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50/80 p-4">
                    <p className="text-sm font-mono text-red-700 break-all">
                      {this.state.error.message}
                    </p>
                  </div>
                )}

                {process.env.NODE_ENV === "development" &&
                  this.state.errorInfo && (
                    <details className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
                        Error Details (Development Only)
                      </summary>
                      <pre className="mt-3 text-xs font-mono text-slate-600 whitespace-pre-wrap overflow-x-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={this.handleReload}
                  variant="default"
                  className="flex-1"
                >
                  Reload Page
                </Button>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-700">
                <p className="font-medium mb-2">Need Help?</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Check the browser console for more details</li>
                  <li>
                    Verify your API keys are correctly configured in Settings
                  </li>
                  <li>Ensure you have a stable internet connection</li>
                  <li>
                    Try clearing your browser cache and reloading the page
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

