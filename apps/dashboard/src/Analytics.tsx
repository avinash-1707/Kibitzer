import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { Analytics } from "@kibitzer/shared";
import { fetchAnalytics } from "./api.ts";
import { dramaColor } from "./drama.ts";

export function AnalyticsTab({ sessionId }: { sessionId: string | null }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;

    const load = () =>
      fetchAnalytics(sessionId)
        .then((a) => {
          if (alive) {
            setData(a);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (alive) setError(e instanceof Error ? e.message : "failed");
        });

    load(); // on mount
    const id = setInterval(load, 5000); // poll every ~5s (api-reference.md)
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [sessionId]);

  if (!sessionId)
    return (
      <div className="empty-state">
        <span className="standby-ring" aria-hidden="true">
          <span className="standby-dot" />
        </span>
        <p className="empty-title">No active session yet.</p>
        <p className="empty-sub">Analytics populate once an agent connects.</p>
      </div>
    );
  if (error && !data)
    return (
      <div className="empty-state">
        <p className="empty-title">Analytics unavailable</p>
        <p className="empty-sub">{error}</p>
      </div>
    );
  if (!data) return <AnalyticsSkeleton />;

  const totalCalls = Object.values(data.toolCallsByType).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="analytics">
      <div className="cards">
        <Card label="Tool calls" value={totalCalls} />
        <Card label="Files touched" value={data.filesTouched.length} />
        <Card
          label="Tests"
          value={`${data.tests.pass}✓ / ${data.tests.fail}✗`}
        />
        <Card label="Duration" value={formatDuration(data.durationMs)} />
        <Card label="Backtracks" value={data.backtrackCount} />
      </div>

      <div className="panels">
        <section className="panel">
          <h3>Tool calls by type</h3>
          <ToolBreakdown byType={data.toolCallsByType} total={totalCalls} />
        </section>

        <section className="panel">
          <h3>Files touched</h3>
          {data.filesTouched.length === 0 ? (
            <p className="empty small">None yet.</p>
          ) : (
            <ul className="files">
              {data.filesTouched.map((f) => (
                <li key={f.path}>
                  <code>{f.path}</code>
                  <span className="edit-count">{f.editCount}×</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <h3>Risk log</h3>
        {data.riskLog.length === 0 ? (
          <p className="empty small">No high-drama moments yet.</p>
        ) : (
          <ul className="risk">
            {data.riskLog.map((r) => (
              <li key={r.eventId}>
                <span
                  className="risk-dot"
                  style={{ background: dramaColor(r.dramaScore) }}
                />
                <span className="risk-line">{r.logLine}</span>
                <span
                  className="risk-score"
                  style={{ color: dramaColor(r.dramaScore) }}
                >
                  {r.dramaScore}
                </span>
                <time className="risk-time">
                  {new Date(r.timestamp).toLocaleTimeString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ToolBreakdown({
  byType,
  total,
}: {
  byType: Record<string, number>;
  total: number;
}) {
  const rows = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return <p className="empty small">No tool calls yet.</p>;
  return (
    <ul className="bars">
      {rows.map(([tool, count]) => {
        const pct = total ? (count / total) * 100 : 0;
        return (
          <li key={tool} className="bar-row">
            <span className="bar-label">{tool}</span>
            <span className="bar-track">
              <motion.span
                className="bar-fill"
                style={{ transformOrigin: "left" }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: pct / 100 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0 }}
              />
            </span>
            <span className="bar-count">{count}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Shimmer placeholders shaped like the real layout, shown while `data` is null. */
function AnalyticsSkeleton() {
  return (
    <div className="analytics" aria-busy="true" aria-label="Loading analytics">
      <div className="cards">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="stat stat-skel" key={i}>
            <div className="skel skel-value" />
            <div className="skel skel-label" />
          </div>
        ))}
      </div>
      <div className="panels">
        <section className="panel">
          <h3>Tool calls by type</h3>
          <div className="bars">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="bar-row" key={i}>
                <div className="skel skel-line" style={{ width: "48px" }} />
                <div className="skel skel-bar" />
                <div className="skel skel-line" style={{ width: "20px" }} />
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h3>Files touched</h3>
          <div className="files">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="skel skel-line" key={i} style={{ width: `${70 - i * 8}%` }} />
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <h3>Risk log</h3>
        <div className="risk">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="skel skel-line" key={i} style={{ width: `${85 - i * 12}%` }} />
          ))}
        </div>
      </section>
    </div>
  );
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
