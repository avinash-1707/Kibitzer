# Kibitzer — Mobile App (primary interface)

The app is the main way you watch a session: a native live feed, on-device audio narration,
and an analytics/audit view. It talks only to the backend's existing HTTP + SSE endpoints
(`api-reference.md`) over a public tunnel — no app-specific backend code beyond what already
exists.

> Verified against current sources (Aug 2026): `react-native-sse@1.2.1`, `expo-audio@57.0.4`
> (SDK 57; `expo-av` is deprecated, removed in SDK 55), and ngrok for the tunnel. **Cloudflare
> quick tunnels are NOT usable** — their docs state quick tunnels don't support SSE, and the
> whole feed is SSE. Use ngrok (or a named, authenticated Cloudflare Tunnel).

## Stack & dependencies

| Concern | Choice | Install |
|---|---|---|
| App framework | Expo (installed dev build on-device, not Expo Go) | `npx create-expo-app` |
| Navigation | Expo Router (file-based) or React Navigation | `npx expo install expo-router` |
| Live feed | `react-native-sse` (pure-JS EventSource, custom events, Hermes-safe) | `npm i react-native-sse` |
| Audio | `expo-audio` (NOT `expo-av`) | `npx expo install expo-audio` |
| QR scan (pairing) | `expo-camera` (barcode scanning) | `npx expo install expo-camera` |
| Storage (paired URL) | `expo-secure-store` or `@react-native-async-storage/async-storage` | `npx expo install …` |

Push notifications are **out of scope** for this build (needs a credentialed dev build; drama
spikes animate in-feed instead).

## App structure

```
apps/mobile/
├─ app.json
├─ app/                         # expo-router screens
│  ├─ index.tsx                 # Pairing (if unpaired) → redirect to /feed
│  ├─ feed.tsx                  # Feed (home)
│  ├─ analytics.tsx             # Analytics
│  └─ _layout.tsx               # tabs / stack
├─ src/
│  ├─ base.ts                   # paired base URL: get/set/clear (SecureStore)
│  ├─ useEventStream.ts         # react-native-sse hook (named events → handlers)
│  ├─ audioQueue.ts             # expo-audio sequential clip queue
│  ├─ store.ts                  # feed items + drama score (Zustand or useReducer)
│  └─ api.ts                    # fetch helpers (analytics, persona, wrap-up)
```

## Pairing / tunnel

1. On boot the backend prints an **ngrok** URL (`ngrok http 8787`) and renders it as a QR
   (the server can print a QR to the terminal, or the dashboard shows one). The URL is the
   base for everything: `<base>/events/stream`, `<base>/api/tts?…`, `<base>/session/:id/…`.
2. The app's Pairing screen scans the QR (`expo-camera`) or accepts a pasted URL, validates it
   with a quick `GET <base>/persona`, stores it (`base.ts`), and routes to the Feed.
3. All subsequent requests use `<base>` as the origin. Since every request goes to `<base>`,
   there is **no CORS concern for the app** (the web dashboard is the only CORS case — see
   `api-reference.md`).

```ts
// src/base.ts
import * as SecureStore from "expo-secure-store";
const KEY = "kibitzer.base";
export const getBase = () => SecureStore.getItemAsync(KEY);
export const setBase = (url: string) => SecureStore.setItemAsync(KEY, url.replace(/\/$/, ""));
export const clearBase = () => SecureStore.deleteItemAsync(KEY);
```

## Live feed — SSE hook (`react-native-sse@1.2.1`)

`react-native-sse` is a pure-JS `EventSource` polyfill (XHR under the hood) — no native
module, works in installed dev builds and Hermes. It supports named/custom events and headers.
`event.data` is always a **string**; you `JSON.parse` it yourself. Auto-reconnect is on by
default (`pollingInterval: 5000`); set `0` if you don't want reconnection after a terminal
event.

```ts
// src/useEventStream.ts
import { useEffect, useRef } from "react";
import EventSource, { type EventSourceListener } from "react-native-sse";

type StreamEvents = "hello" | "replay" | "score" | "narration" | "audio" | "persona" | "ping";

export interface StreamHandlers {
  onHello?: (d: { sessionId: string | null }) => void;
  onReplay?: (d: FeedItem) => void;
  onScore?: (d: { eventId: string; dramaScore: number }) => void;
  onNarration?: (d: FeedItem) => void;
  onAudio?: (d: { eventId: string; audioUrl: string }) => void;
  onPersona?: (d: { persona: string }) => void;
}

export function useEventStream(base: string, handlers: StreamHandlers) {
  const ref = useRef(handlers); ref.current = handlers; // no stale closures, no re-subscribe

  useEffect(() => {
    if (!base) return;
    const es = new EventSource<StreamEvents>(`${base}/events/stream`, {
      pollingInterval: 3000, // reconnect if the stream drops mid-session
      debug: __DEV__,
    });

    const dispatch: EventSourceListener<StreamEvents> = (event) => {
      if (event.type === "error" || event.type === "exception") return; // surface if desired
      if (!("data" in event) || !event.data) return;
      const d = JSON.parse(event.data);
      switch (event.type) {
        case "hello":     ref.current.onHello?.(d); break;
        case "replay":    ref.current.onReplay?.(d); break;
        case "score":     ref.current.onScore?.(d); break;
        case "narration": ref.current.onNarration?.(d); break;
        case "audio":     ref.current.onAudio?.(d); break;
        case "persona":   ref.current.onPersona?.(d); break;
      }
    };

    (["hello", "replay", "score", "narration", "audio", "persona"] as const)
      .forEach((t) => es.addEventListener(t, dispatch));

    return () => { es.removeAllEventListeners(); es.close(); };
  }, [base]);
}
```

Merge frames by `event.id` into the feed store: `score` sets/updates the meter first,
`narration` adds/updates the text, `audio` attaches the play URL (and auto-enqueues it).
`FeedItem` is the shape from `api-reference.md`.

## On-device audio — sequential queue (`expo-audio@57.0.4`)

`expo-av` is deprecated (removed in SDK 55) — use `expo-audio`. **Critical gotcha (verified
via expo/expo#41852, #34162):** creating a new player per clip leaks and, after ~40
create/remove cycles, players stop firing events unless you call BOTH `.remove()` and
`.release()`. Avoid it entirely: create **one** long-lived player and `.replace()` its source
per clip.

```ts
// src/audioQueue.ts
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from "expo-audio";

export class AudioQueue {
  private player: AudioPlayer;
  private queue: string[] = [];
  private playing = false;

  constructor() { this.player = createAudioPlayer(); } // one reused player

  enqueue(url: string) {
    this.queue.push(url);
    if (!this.playing) void this.drain();
  }

  private async drain() {
    this.playing = true;
    while (this.queue.length) await this.playOne(this.queue.shift()!);
    this.playing = false;
  }

  private playOne(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.player.replace({ uri: url });
      const sub = this.player.addListener("playbackStatusUpdate", (s: AudioStatus) => {
        if (s.error)          { sub.remove(); reject(new Error(String(s.error))); }
        else if (s.didJustFinish) { sub.remove(); resolve(); }
      });
      this.player.play();
    });
  }

  dispose() { this.player.remove(); this.player.release(); } // BOTH — required
}
```

Wire it to the SSE hook: `onAudio: (d) => audioQueue.enqueue(d.audioUrl)`. Because clips play
strictly one after another, narration lines never overlap — the same guarantee the dashboard
gets from queued `<audio>`.

## Screens

### Pairing (`app/index.tsx`)
- If `getBase()` returns a URL, redirect straight to `/feed`.
- Else: camera QR scanner + a "paste URL" fallback. On a valid URL, `setBase` and route.

### Feed (`app/feed.tsx`) — home
- Drama meter pinned top (0–100, green→red), driven by `score` frames.
- Vertical list of feed cards (newest first): narration text, drama-color strip, source badge,
  a play button → `audioQueue.enqueue(item.audioUrl)`. Auto-play the newest on arrival.
- Persona control → `PUT <base>/persona` (affects future lines only).
- "Wrap up session" → `POST <base>/session/:id/end`, then navigate to a devpost view.

### Analytics (`app/analytics.tsx`)
- `GET <base>/session/:id/analytics` on mount + poll every 5s (`sessionId` from the `hello`
  frame). Native summary cards, a `toolCallsByType` breakdown (simple bars/counts), a
  files-touched list, and the risk log (`riskLog[].logLine`). Response shape in
  `api-reference.md`.

## Feature → endpoint map

| App feature | Backend | Notes |
|---|---|---|
| Live feed | `GET <base>/events/stream` (SSE) | `react-native-sse`, named events |
| Audio playback | `GET <base>/api/tts?eventId=…` | `expo-audio`, one-player queue |
| Analytics | `GET <base>/session/:id/analytics` | mount + 5s poll |
| Persona | `GET`/`PUT <base>/persona` | global state |
| Wrap up | `POST <base>/session/:id/end` | devpost draft |
| Pairing | (none — client stores `<base>`) | QR encodes the ngrok URL |

## Non-goals (this build)
- Push notifications (needs credentialed dev build — cut).
- Offline/caching, multi-session switching, auth — single-session demo.
