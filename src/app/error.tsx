"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap flex min-h-[60svh] flex-col items-start justify-center">
      <h1 className="display text-5xl">Something went wrong.</h1>
      <p className="mt-4 max-w-xl text-lg text-ink-2">{error.message || "An unexpected error interrupted the page."}</p>
      <button type="button" className="btn btn-ink mt-8" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
