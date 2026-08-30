import { useState } from "react";
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
        <p className="empty">
          Waiting for the agent… narrated lines appear here as it works.
        </p>
      ) : (
        <ul className="feed">
          {stream.feed.map((item) => (
            <FeedCard key={item.event.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DramaMeter({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="meter">
      <div className="meter-head">
        <span>Drama</span>
        <strong style={{ color: dramaColor(pct) }}>{Math.round(pct)}</strong>
      </div>
      <div className="meter-track">
        <div
          className="meter-fill"
          style={{ width: `${pct}%`, background: dramaColor(pct) }}
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
          {p}
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
    <li className="card">
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
          {item.narration ?? <span className="pending">narrating…</span>}
        </p>
        {detail && <p className="card-detail">{detail}</p>}
        {item.audioUrl && (
          <audio className="card-audio" controls src={item.audioUrl} />
        )}
      </div>
    </li>
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
