import { useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { useEventStream } from "./useEventStream.ts";
import { Commentary } from "./Commentary.tsx";
import { AnalyticsTab } from "./Analytics.tsx";
import { WrapUp } from "./WrapUp.tsx";

type Tab = "commentary" | "analytics";

const TABS: { key: Tab; label: string }[] = [
  { key: "commentary", label: "Commentary" },
  { key: "analytics", label: "Analytics" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("commentary");
  const stream = useEventStream();

  return (
    // reducedMotion="user" makes every motion.* component (feed cards, tab
    // pill, wrap-up modal) auto-respect the OS prefers-reduced-motion setting.
    <MotionConfig reducedMotion="user">
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className={stream.connected ? "brand-dot on-air" : "brand-dot"} />
            <span className="brand-word">Kibitzer</span>
            <span className="brand-sub">dashboard</span>
          </div>

          <nav className="tabs" role="tablist" aria-label="View">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? "tab active" : "tab"}
                onClick={() => setTab(key)}
              >
                {tab === key && (
                  <motion.span
                    layoutId="tab-pill"
                    className="tab-pill"
                    transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                  />
                )}
                <span className="tab-label">{label}</span>
              </button>
            ))}
          </nav>

          <div className="status">
            <span className="conn-wrap" title={stream.connected ? "connected" : "disconnected"}>
              <span className={stream.connected ? "conn on" : "conn off"} />
              <span className="conn-label">{stream.connected ? "ON AIR" : "OFFLINE"}</span>
            </span>
            <code className="session">{stream.sessionId ?? "no session"}</code>
            <WrapUp sessionId={stream.sessionId} />
          </div>
        </header>

        <main className="content">
          {/* Both tabs stay mounted so Commentary's SSE feed and Analytics'
              poll each keep running; only visibility crossfades via CSS
              (data-active), never a conditional unmount. */}
          <section
            className="tab-panel"
            data-active={tab === "commentary"}
            aria-hidden={tab !== "commentary"}
            inert={tab !== "commentary"}
          >
            <Commentary stream={stream} />
          </section>
          <section
            className="tab-panel"
            data-active={tab === "analytics"}
            aria-hidden={tab !== "analytics"}
            inert={tab !== "analytics"}
          >
            <AnalyticsTab sessionId={stream.sessionId} />
          </section>
        </main>
      </div>
    </MotionConfig>
  );
}
