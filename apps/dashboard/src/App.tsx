import { useState } from "react";
import { useEventStream } from "./useEventStream.ts";
import { Commentary } from "./Commentary.tsx";
import { AnalyticsTab } from "./Analytics.tsx";
import { WrapUp } from "./WrapUp.tsx";

type Tab = "commentary" | "analytics";

export function App() {
  const [tab, setTab] = useState<Tab>("commentary");
  const stream = useEventStream();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          Kibitzer
          <span className="brand-sub">dashboard</span>
        </div>
        <nav className="tabs">
          <button
            className={tab === "commentary" ? "tab active" : "tab"}
            onClick={() => setTab("commentary")}
          >
            Commentary
          </button>
          <button
            className={tab === "analytics" ? "tab active" : "tab"}
            onClick={() => setTab("analytics")}
          >
            Analytics
          </button>
        </nav>
        <div className="status">
          <span
            className={stream.connected ? "conn on" : "conn off"}
            title={stream.connected ? "connected" : "disconnected"}
          />
          <code className="session">{stream.sessionId ?? "no session"}</code>
          <WrapUp sessionId={stream.sessionId} />
        </div>
      </header>

      <main className="content">
        {/* Both tabs stay mounted so Commentary's SSE feed and Analytics' poll
            each keep running; only visibility toggles (instant tab switch). */}
        <section hidden={tab !== "commentary"}>
          <Commentary stream={stream} />
        </section>
        <section hidden={tab !== "analytics"}>
          <AnalyticsTab sessionId={stream.sessionId} />
        </section>
      </main>
    </div>
  );
}
