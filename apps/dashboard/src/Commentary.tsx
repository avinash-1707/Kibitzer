import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import type { FeedItem, PersonaKey } from "@kibitzer/shared";
import type { StreamState } from "./useEventStream.ts";
import { setPersona } from "./api.ts";
import { dramaColor } from "./drama.ts";

const PERSONAS: PersonaKey[] = ["sports", "nature"];

export function Commentary({ stream }: { stream: StreamState }) {
  return (
    <div className="commentary">
      <div className="commentary-controls">
        {/* Fall back to the newest feed item's score so the meter isn't stuck at
            0 after a reload/reconnect before the next live `score` frame. */}
        <DramaMeter
          score={stream.latestScore || stream.feed[0]?.dramaScore || 0}
        />
        <PersonaSwitcher active={stream.persona} />
      </div>

      {stream.feed.length === 0 ? (
        <div className="empty-state">
          <span className="standby-ring" aria-hidden="true">
            <span className="standby-dot" />
          </span>
          <p className="empty-title">Waiting for the agent…</p>
          <p className="empty-sub">
            Narrated lines appear here the moment it starts working.
          </p>
        </div>
      ) : (
        <ul className="feed">
          <AnimatePresence initial={false}>
            {stream.feed.map((item) => (
              <FeedCard key={item.event.id} item={item} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function DramaMeter({ score }: { score: number }) {
  // Guard a non-finite score: NaN would permanently poison the spring and
  // render the literal text "NaN".
  const pct = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const color = dramaColor(pct);
  const hot = pct >= 70;
  const reduceMotion = useReducedMotion();

  // Spring-driven value powers both the fill width and the rolling number —
  // one physical motion instead of two things separately snapping to place.
  const progress = useMotionValue(pct);
  const spring = useSpring(progress, { stiffness: 140, damping: 24, mass: 0.6 });
  const rounded = useTransform(spring, (v) => Math.round(v));
  // scaleX (transform) instead of width — avoids layout reflow on every tick.
  const scaleX = useTransform(spring, (v) => v / 100);

  useEffect(() => {
    progress.set(pct);
  }, [pct, progress]);

  return (
    <div className="meter">
      <div className="meter-head">
        <span>Drama</span>
        <motion.strong className="meter-value" style={{ color }}>
          {reduceMotion ? Math.round(pct) : rounded}
        </motion.strong>
      </div>
      <div className={hot ? "meter-track hot" : "meter-track"}>
        <motion.div
          // background transitions via the plain CSS rule below (.meter-fill);
          // only the transform is spring-driven through the shared MotionValue.
          className={hot ? "meter-fill hot" : "meter-fill"}
          style={{
            transformOrigin: "left",
            scaleX: reduceMotion ? pct / 100 : scaleX,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function PersonaSwitcher({ active }: { active: PersonaKey | null }) {
  // Optimistic local echo; the server also broadcasts a `persona` frame which
  // updates `active` through the stream (source of truth).
  const [pending, setPending] = useState<PersonaKey | null>(null);
  const current = pending ?? active;

  return (
    <div className="persona" role="group" aria-label="Persona">
      {PERSONAS.map((p) => (
        <button
          key={p}
          className={current === p ? "persona-btn active" : "persona-btn"}
          disabled={pending !== null}
          onClick={() => {
            setPending(p);
            setPersona(p).finally(() => setPending(null));
          }}
        >
          {current === p && (
            <motion.span
              layoutId="persona-pill"
              className="persona-pill"
              transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            />
          )}
          <span className="persona-label">{p}</span>
        </button>
      ))}
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const color = dramaColor(item.dramaScore);
  const { event } = item;
  const when = new Date(event.timestamp).toLocaleTimeString();
  const detail = describeDetail(item);

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
      transition={{ type: "spring", duration: 0.4, bounce: 0 }}
      className="card"
    >
      <span className="card-strip" style={{ background: color }} />
      <div className="card-body">
        <div className="card-meta">
          <span className={`badge badge-${event.source}`}>{event.source}</span>
          <span className="card-type">{event.type}</span>
          <span className="card-time">{when}</span>
          <span className="card-drama" style={{ color }}>
            {Math.round(item.dramaScore)}
          </span>
        </div>
        <p className="card-narration">
          {item.narration ?? (
            <span className="pending pending-shimmer">narrating…</span>
          )}
        </p>
        {detail && <p className="card-detail">{detail}</p>}
        {item.audioUrl && (
          <audio className="card-audio" controls src={item.audioUrl} />
        )}
      </div>
    </motion.li>
  );
}

/** A terse "what actually happened" line from the event detail, no LLM. */
function describeDetail(item: FeedItem): string | null {
  const d = item.event.detail;
  const parts: string[] = [];
  if (d.tool) parts.push(d.tool);
  if (d.command) parts.push(`\`${d.command}\``);
  if (d.filePath) parts.push(d.filePath);
  if (d.outcome && d.outcome !== "unknown") parts.push(`→ ${d.outcome}`);
  return parts.length ? parts.join(" ") : null;
}
