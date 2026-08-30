import { useState } from "react";
import type { Devpost } from "@kibitzer/shared";
import { wrapUp } from "./api.ts";

export function WrapUp({ sessionId }: { sessionId: string | null }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Devpost | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    wrapUp(sessionId)
      .then(setResult)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "failed"),
      )
      .finally(() => setBusy(false));
  };

  const dismiss = () => {
    setResult(null);
    setError(null);
  };

  return (
    <>
      <button
        className="wrapup-btn"
        onClick={run}
        disabled={!sessionId || busy}
      >
        {busy ? "Wrapping…" : "Wrap up session"}
      </button>

      {(result || error) && (
        <div className="modal" onClick={dismiss}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Devpost draft</h3>
              <button className="modal-close" onClick={dismiss}>
                ×
              </button>
            </div>
            {error ? (
              <p className="empty">Wrap-up failed: {error}</p>
            ) : (
              result && (
                <div className="devpost">
                  <pre className="devpost-post">{result.post}</pre>
                  {result.tweetThread.length > 0 && (
                    <>
                      <h4>Tweet thread</h4>
                      <ol className="tweets">
                        {result.tweetThread.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
