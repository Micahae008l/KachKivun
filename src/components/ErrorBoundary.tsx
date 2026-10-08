import { Component, type ErrorInfo, type ReactNode } from "react";
import { trackError } from "@/lib/analytics";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    trackError(error.message, "error_boundary");
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center px-4 text-center" dir="rtl">
          <p className="font-mono text-4xl font-black text-destructive">שגיאה</p>
          <p className="mt-3 text-sm text-dust">
            משהו השתבש. נסו לרענן את הדף.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary mt-6 px-6 py-2.5"
          >
            רענון
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-4 max-w-full overflow-x-auto rounded-sm bg-card p-3 text-left text-xs text-destructive/80">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
