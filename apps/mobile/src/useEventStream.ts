// SSE subscription to the backend feed. Named events → typed handlers.
// react-native-sse is a pure-JS EventSource polyfill (XHR under the hood), Hermes-safe.
// `event.data` is always a string; we JSON.parse it ourselves. Auto-reconnect is on.
import { useEffect, useRef, useState } from "react";
import EventSource, { type EventSourceListener } from "react-native-sse";
import type {
  FeedItem,
  HelloFrame,
  ScoreFrame,
  AudioFrame,
  PersonaFrame,
} from "@kibitzer/shared";

// The named SSE frames we subscribe to (`ping` is a heartbeat we ignore).
type StreamEvents = "hello" | "replay" | "score" | "narration" | "audio" | "persona";

export interface StreamHandlers {
  onHello?: (d: HelloFrame) => void;
  onReplay?: (d: FeedItem) => void;
  onScore?: (d: ScoreFrame) => void;
  onNarration?: (d: FeedItem) => void;
  onAudio?: (d: AudioFrame) => void;
  onPersona?: (d: PersonaFrame) => void;
}

/** Connection state so a screen can show connecting/disconnected UI. */
export type StreamStatus = "connecting" | "open" | "error";

// Minimal shape guards — one bad frame (missing eventId, malformed JSON) must not
// crash the dispatcher or seed `items["undefined"]` downstream.
function hasEventId(d: unknown): d is { eventId: string } {
  return typeof (d as { eventId?: unknown })?.eventId === "string";
}
function hasFeedEventId(d: unknown): d is FeedItem {
  return typeof (d as FeedItem)?.event?.id === "string";
}

/**
 * Subscribe to `<base>/events/stream` and route each named frame to a handler.
 * Handlers are kept in a ref so updating them never re-subscribes (no stale closures).
 * Re-subscribes only when `base` changes. Returns the connection status.
 */
export function useEventStream(base: string, handlers: StreamHandlers): StreamStatus {
  const ref = useRef(handlers);
  ref.current = handlers;
  const [status, setStatus] = useState<StreamStatus>("connecting");

  useEffect(() => {
    if (!base) return;
    setStatus("connecting");

    const es = new EventSource<StreamEvents>(`${base}/events/stream`, {
      pollingInterval: 3000, // reconnect if the stream drops mid-session
      debug: __DEV__,
    });

    es.addEventListener("open", () => setStatus("open"));
    es.addEventListener("error", () => setStatus("error"));

    const dispatch: EventSourceListener<StreamEvents> = (event) => {
      if (event.type === "error" || event.type === "exception") return;
      if (!("data" in event) || !event.data) return;
      let d: unknown;
      try {
        d = JSON.parse(event.data);
      } catch {
        return; // drop unparseable frames rather than crash
      }
      switch (event.type) {
        case "hello":
          ref.current.onHello?.(d as HelloFrame);
          break;
        case "replay":
          if (hasFeedEventId(d)) ref.current.onReplay?.(d);
          break;
        case "score":
          if (hasEventId(d)) ref.current.onScore?.(d as ScoreFrame);
          break;
        case "narration":
          if (hasFeedEventId(d)) ref.current.onNarration?.(d);
          break;
        case "audio":
          if (hasEventId(d)) ref.current.onAudio?.(d as AudioFrame);
          break;
        case "persona":
          ref.current.onPersona?.(d as PersonaFrame);
          break;
      }
    };

    (["hello", "replay", "score", "narration", "audio", "persona"] as const).forEach(
      (t) => es.addEventListener(t, dispatch),
    );

    return () => {
      es.removeAllEventListeners();
      es.close();
    };
  }, [base]);

  return status;
}
