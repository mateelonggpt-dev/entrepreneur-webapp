"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled frontend error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium text-primary">Matter Acc.</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Unable to load the app</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The frontend is running, but the request failed while loading data or rendering the page.
          Make sure the Flask backend is running from <code>backend/.venv</code> on{" "}
          <code>http://localhost:5000</code>.
        </p>
        <div className="mt-5 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
          {error.message || "Unknown error"}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-95"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Go to home
          </button>
        </div>
      </div>
    </main>
  );
}
