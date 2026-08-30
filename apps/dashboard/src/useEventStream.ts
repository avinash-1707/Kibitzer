import { useEffect, useState } from "react";
import type {
  FeedItem,
  HelloFrame,
  ScoreFrame,
  AudioFrame,
  PersonaFrame,
  PersonaKey,
} from "@kibitzer/shared";

export interface StreamState {
  sessionId: string | null;
  persona: PersonaKey | null;
  /** Feed items, newest first, merged by event.id across score/narration/audio frames. */
  feed: FeedItem[];
  /** Latest dramaScore seen on any `score` frame — drives the meter, which reacts before narration text. */
  latestScore: number;
  connected: boolean;
}

const EMPTY: StreamState = {
  sessionId: null,
  persona: null,
  feed: [],
  latestScore: 0,
  connected: false,
};

/**
 * Single browser EventSource on `/events/stream` (proxied to :8787 in dev).
 * Merges the three live frames (score → narration → audio) by `event.id` so the
 * feed shows the meter, then text, then a play button. Commentary renders purely
 * from this; Analytics polls its own endpoint (see api-reference.md).
 */
export function useEventStream(): StreamState {
  const [state, setState] = useState<StreamState>(EMPTY);

  useEffect(() => {
    // Merge a frame into the feed by event.id. The updater is pure (position is
    // derived from `prev` each call), so React 19 StrictMode double-invocation
    // and concurrent rebasing both converge to the same feed.
    const upsert = (id: string, patch: Partial<FeedItem>, base?: FeedItem) => {
      setState((prev) => {
        // SIMPLIFIED: O(n) scan per frame; index it if the feed ever outgrows a
        // few hundred items (a single demo session won't).
        const pos = prev.feed.findIndex((f) => f.event.id === id);
        if (pos === -1) {
          // score/audio before narration has no item to anchor — dropped. Safe:
          // the narration FeedItem carries dramaScore, and a lost narration frame
          // (so its audio has no anchor) is a demo-acceptable ceiling.
          return base
            ? { ...prev, feed: sortNewestFirst([...prev.feed, base]) }
            : prev;
        }
        const feed = prev.feed.slice();
        feed[pos] = mergeItem(feed[pos], patch);
        return { ...prev, feed: sortNewestFirst(feed) };
      });
    };

    const es = new EventSource("/events/stream");

    es.addEventListener("open", () =>
      setState((p) => ({ ...p, connected: true })),
    );
    es.addEventListener("error", () =>
      setState((p) => ({ ...p, connected: false })),
    );

    es.addEventListener("hello", (e) => {
      const { sessionId } = JSON.parse((e as MessageEvent).data) as HelloFrame;
      setState((p) => ({ ...p, sessionId, connected: true }));
    });

    const addFeedItem = (e: Event) => {
      const item = JSON.parse((e as MessageEvent).data) as FeedItem;
      upsert(item.event.id, item, item);
    };
    es.addEventListener("replay", addFeedItem);
    es.addEventListener("narration", addFeedItem);

    es.addEventListener("score", (e) => {
      const { eventId, dramaScore } = JSON.parse(
        (e as MessageEvent).data,
      ) as ScoreFrame;
      setState((p) => ({ ...p, latestScore: dramaScore }));
      upsert(eventId, { dramaScore });
    });

    es.addEventListener("audio", (e) => {
      const { eventId, audioUrl } = JSON.parse(
        (e as MessageEvent).data,
      ) as AudioFrame;
      upsert(eventId, { audioUrl });
    });

    es.addEventListener("persona", (e) => {
      const { persona } = JSON.parse((e as MessageEvent).data) as PersonaFrame;
      setState((p) => ({ ...p, persona }));
    });

    return () => es.close();
  }, []);

  return state;
}

// Nullish patch fields never clobber an already-populated value — protects
// against EventSource auto-reconnect re-sending `replay` frames with null
// narration/audioUrl after those have resolved. `??` keeps dramaScore 0 valid.
function mergeItem(cur: FeedItem, patch: Partial<FeedItem>): FeedItem {
  return {
    event: patch.event ?? cur.event,
    dramaScore: patch.dramaScore ?? cur.dramaScore,
    narration: patch.narration ?? cur.narration,
    audioUrl: patch.audioUrl ?? cur.audioUrl,
  };
}

function sortNewestFirst(feed: FeedItem[]): FeedItem[] {
  return feed
    .slice()
    .sort(
      (a, b) => Date.parse(b.event.timestamp) - Date.parse(a.event.timestamp),
    );
}
