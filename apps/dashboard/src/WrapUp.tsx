import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
        {busy ? (
          <span className="btn-busy">
            <span className="spinner" aria-hidden="true" />
            Wrapping…
          </span>
        ) : (
          "Wrap up session"
        )}
      </button>

      <AnimatePresence>
        {(result || error) && (
          <motion.div
            className="modal"
            onClick={dismiss}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <motion.div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 4 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            >
              <div className="modal-head">
                <h3>Devpost draft</h3>
                <button className="modal-close" onClick={dismiss} aria-label="Close">
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
