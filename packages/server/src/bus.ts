// Realtime pub/sub. Single Bun process, so a plain Set<SSEStreamingApi> is the whole thing.
// Public interface FROZEN by Unit 0 — downstream units import these, never edit this file.
import type { SSEStreamingApi } from "hono/streaming";

const clients = new Set<SSEStreamingApi>();

export function addClient(s: SSEStreamingApi): void {
  clients.add(s);
}

export function removeClient(s: SSEStreamingApi): void {
  clients.delete(s);
}

/** Fan a frame out to every connected SSE client. `kind` is the SSE event name. */
export function broadcast(kind: string, data: unknown): void {
  const payload = JSON.stringify(data);
  for (const s of clients) {
    s.writeSSE({ event: kind, data: payload }).catch(() => {});
  }
}
