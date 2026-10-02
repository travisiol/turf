"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#F8F4EA", color: "#162018", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 480, padding: 32, background: "#fff", borderRadius: 28 }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px", fontWeight: 900 }}>Something went wrong.</h1>
          <p style={{ color: "#3F4A41", fontSize: 16, lineHeight: 1.5 }}>{error.message || "An unexpected error interrupted the page."}</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, background: "#162018", color: "#fff", border: 0, padding: "14px 24px", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
