import { useEffect, useState } from "react";
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
    return <p className="empty">No active session yet.</p>;
  if (error && !data)
    return <p className="empty">Analytics unavailable: {error}</p>;
  if (!data) return <p className="empty">Loading analytics…</p>;

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
      {rows.map(([tool, count]) => (
        <li key={tool} className="bar-row">
          <span className="bar-label">{tool}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: total ? `${(count / total) * 100}%` : "0%" }}
            />
          </span>
          <span className="bar-count">{count}</span>
        </li>
      ))}
    </ul>
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
