// Owned by Unit B. Mounts GET /events/stream (SSE).
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { HelloFrame } from "@kibitzer/shared";
import { addClient, removeClient } from "../bus.ts";
import { activeSessionId, getRing } from "../store.ts";

export const streamRoutes = new Hono();

// On connect: `hello` (active sessionId, sent FIRST so the client can start analytics
// polling), then replay the ring as `replay` frames, then live frames from the bus + a 15s
// `ping` heartbeat. Gotcha: streamSSE closes the response when its callback resolves — so we
// await a promise resolved only on abort/failure.
// Ordering matters: register onAbort BEFORE any write (a disconnect mid-replay must still
// clean up), and register the client with the bus only AFTER replay so live frames can't
// interleave between replay frames.
streamRoutes.get("/events/stream", (c) =>
  streamSSE(c, async (stream) => {
    let hb: ReturnType<typeof setInterval> | undefined;
    let done!: () => void;
    const closed = new Promise<void>((resolve) => (done = resolve));
    const cleanup = () => {
      if (hb) clearInterval(hb);
      removeClient(stream);
      done();
    };

    stream.onAbort(cleanup);

    try {
      const hello: HelloFrame = { sessionId: activeSessionId() };
      await stream.writeSSE({ event: "hello", data: JSON.stringify(hello) });

      for (const item of getRing()) {
        await stream.writeSSE({ event: "replay", data: JSON.stringify(item) });
      }

      addClient(stream); // only now may live frames arrive
      hb = setInterval(() => {
        stream.writeSSE({ event: "ping", data: "" }).catch(cleanup);
      }, 15000);

      await closed;
    } finally {
      cleanup();
    }
  }),
);
