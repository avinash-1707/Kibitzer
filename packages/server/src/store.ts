// Event store: bun:sqlite (WAL) for persistence + an in-memory FeedItem ring for the hot path.
// Public interface FROZEN by Unit 0 — downstream units import these, never edit this file.
import { Database } from "bun:sqlite";
import type {
  FeedItem,
  KibitzerEvent,
  KibitzerEventDetail,
  PersonaKey,
} from "@kibitzer/shared";

const db = new Database(process.env.KIBITZER_DB ?? "kibitzer.sqlite", {
  create: true,
});
db.run("PRAGMA journal_mode = WAL;");

db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    sessionId   TEXT NOT NULL,
    source      TEXT NOT NULL,
    type        TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    detail      TEXT NOT NULL,
    dramaScore  INTEGER,
    narration   TEXT,
    audioReady  INTEGER DEFAULT 0
  )
`);
db.run(
  "CREATE INDEX IF NOT EXISTS idx_events_session ON events(sessionId, timestamp)",
);
db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    startedAt  TEXT,
    endedAt    TEXT,
    devpost    TEXT
  )
`);

const insert = db.query(
  `INSERT OR IGNORE INTO events (id, sessionId, source, type, timestamp, detail)
   VALUES ($id, $sessionId, $source, $type, $timestamp, $detail)`,
);
const upsertSession = db.query(
  `INSERT INTO sessions (id, startedAt) VALUES ($id, $ts)
   ON CONFLICT(id) DO NOTHING`,
);
const patchEvent = db.query(
  `UPDATE events SET dramaScore = COALESCE($dramaScore, dramaScore),
                     narration  = COALESCE($narration, narration),
                     audioReady = COALESCE($audioReady, audioReady),
                     detail     = COALESCE($detail, detail)
   WHERE id = $id`,
);

const ring: FeedItem[] = [];

// Global persona state (single-session demo). Read by the pipeline (Unit A), written by
// PUT /persona (Unit B). Frozen accessors so neither unit reinvents the state.
let persona: PersonaKey = "sports";
export const getPersona = (): PersonaKey => persona;
export const setPersona = (p: PersonaKey): void => {
  persona = p;
};

/** Persist an event (idempotent) and upsert its session row. */
export function saveEvent(e: KibitzerEvent): void {
  insert.run({
    $id: e.id,
    $sessionId: e.sessionId,
    $source: e.source,
    $type: e.type,
    $timestamp: e.timestamp,
    $detail: JSON.stringify(e.detail),
  });
  upsertSession.run({ $id: e.sessionId, $ts: e.timestamp });
}

/**
 * Back-write score/narration/audio to SQLite and the in-memory ring. Pass `detail` to
 * re-persist the JSON blob (e.g. after the pipeline sets `isDestructive` in step 0).
 */
export function updateEvent(
  id: string,
  patch: Partial<Pick<FeedItem, "dramaScore" | "narration" | "audioUrl">> & {
    detail?: KibitzerEventDetail;
  },
): void {
  patchEvent.run({
    $id: id,
    $dramaScore: patch.dramaScore ?? null,
    $narration: patch.narration ?? null,
    $audioReady: patch.audioUrl ? 1 : null,
    $detail: patch.detail ? JSON.stringify(patch.detail) : null,
  });
  const { detail, ...feedPatch } = patch;
  const item = ring.find((f) => f.event.id === id);
  if (item) {
    Object.assign(item, feedPatch);
    if (detail) item.event.detail = detail;
  }
}

export function pushFeedItem(item: FeedItem): void {
  ring.push(item);
  if (ring.length > 2000) ring.shift();
}

export const getRing = (): readonly FeedItem[] => ring;

export const activeSessionId = (): string | null =>
  ring.at(-1)?.event.sessionId ?? null;

/** FeedItems that came BEFORE the given event id (prior items only). */
export const recentBefore = (id: string): FeedItem[] => {
  const i = ring.findIndex((f) => f.event.id === id);
  return i === -1 ? ring.slice() : ring.slice(0, i);
};

/** Raw handle for units C (analytics/devpost) that read SQLite directly. */
export const rawDb = db;
