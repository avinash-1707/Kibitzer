// App-side feed store. Merges the SSE frames (score → narration → audio) by event.id
// so a card shows text then a play button without blocking on the slowest stage, while
// the drama meter reacts to `score` frames even before narration lands.
// Zustand; Wave-2 screens consume the selectors/actions below.
import { create } from "zustand";
import type { FeedItem, PersonaKey } from "@kibitzer/shared";

// Feed grows for the whole session; cap it so a long session doesn't balloon memory.
// SIMPLIFIED: hard cap with tail eviction; revisit if sessions need full history.
const MAX_ITEMS = 500;

interface FeedState {
  /** Real feed items (from `replay`/`narration`) keyed by event.id. No placeholders. */
  items: Record<string, FeedItem>;
  /** Insertion order of event ids for `items` (oldest → newest). */
  order: string[];
  /** Drama scores by event.id — updated by `score` frames independent of narration. */
  scores: Record<string, number>;
  /** Active session id from the `hello` frame; drives analytics/wrap-up calls. */
  sessionId: string | null;
  /** Current global persona from the `persona` frame (null until first known). */
  persona: PersonaKey | null;

  // ---- actions (called by the SSE handlers) ----
  setSession: (id: string | null) => void;
  setPersona: (p: PersonaKey) => void;
  /** Upsert a FeedItem (from `replay`/`narration`); seeds score from an earlier frame. */
  upsertItem: (item: FeedItem) => void;
  /** Record a drama score (from a `score` frame) — may precede the narration item. */
  setScore: (eventId: string, dramaScore: number) => void;
  /** Attach the audio URL (from an `audio` frame); no-op if the item isn't known yet. */
  attachAudio: (eventId: string, audioUrl: string) => void;
  /** Wipe feed data only — keeps sessionId/persona (used on stream reset, not unpair). */
  resetFeed: () => void;
  /** Full reset including session/persona (used when re-pairing to a new backend). */
  reset: () => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  items: {},
  order: [],
  scores: {},
  sessionId: null,
  persona: null,

  setSession: (id) => set({ sessionId: id }),
  setPersona: (p) => set({ persona: p }),

  upsertItem: (item) =>
    set((state) => {
      const id = item.event.id;
      const existing = state.items[id];
      // A `score` frame may have arrived first; prefer an explicit score, else the
      // frame's, else what we already had. `??` (not `||`) so a real 0 survives.
      const dramaScore = state.scores[id] ?? item.dramaScore ?? existing?.dramaScore ?? 0;
      const merged: FeedItem = existing
        ? {
            event: item.event,
            dramaScore,
            narration: item.narration ?? existing.narration,
            audioUrl: item.audioUrl ?? existing.audioUrl,
          }
        : { ...item, dramaScore };

      if (existing) {
        return { items: { ...state.items, [id]: merged } };
      }
      let order = [...state.order, id];
      let items = { ...state.items, [id]: merged };
      if (order.length > MAX_ITEMS) {
        const evict = order[0];
        order = order.slice(1);
        const { [evict]: _dropped, ...rest } = items;
        items = rest;
      }
      return { items, order };
    }),

  setScore: (eventId, dramaScore) =>
    set((state) => {
      const scores = { ...state.scores, [eventId]: dramaScore };
      const existing = state.items[eventId];
      if (existing) {
        return { scores, items: { ...state.items, [eventId]: { ...existing, dramaScore } } };
      }
      return { scores }; // meter reacts now; the item lands with narration
    }),

  attachAudio: (eventId, audioUrl) =>
    set((state) => {
      const existing = state.items[eventId];
      if (!existing) return state; // audio for an unknown event — ignore (no ghost)
      return { items: { ...state.items, [eventId]: { ...existing, audioUrl } } };
    }),

  resetFeed: () => set({ items: {}, order: [], scores: {} }),
  reset: () =>
    set({ items: {}, order: [], scores: {}, sessionId: null, persona: null }),
}));

// ---- selectors (Wave-2 imports these) ----
// Each returns a STABLE reference (the stored value itself) or a primitive, so
// subscribing to them can't trigger Zustand v5's getSnapshot re-render loop.
// Screens compose `order` + `items` (e.g. with useMemo) to render newest-first.

export const selectOrder = (s: FeedState): string[] => s.order;
export const selectItems = (s: FeedState): Record<string, FeedItem> => s.items;
export const selectScores = (s: FeedState): Record<string, number> => s.scores;
export const selectSessionId = (s: FeedState): string | null => s.sessionId;
export const selectPersona = (s: FeedState): PersonaKey | null => s.persona;

/** Highest current drama score (drives the meter). Primitive → allocation-safe. */
export const selectDramaScore = (s: FeedState): number => {
  let max = 0;
  for (const id in s.scores) if (s.scores[id] > max) max = s.scores[id];
  return max;
};
