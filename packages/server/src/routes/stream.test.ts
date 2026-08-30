import { expect, test, describe, beforeAll } from "bun:test";
import type { Hono } from "hono";
import type { FeedItem, KibitzerEvent } from "@kibitzer/shared";

// Fresh in-memory DB before store.ts opens it (see analytics.test.ts for the rationale).
process.env.KIBITZER_DB = ":memory:";

let app: Hono;
let pushFeedItem: typeof import("../store.ts").pushFeedItem;

const SESSION = `stream-${crypto.randomUUID()}`;

function feedItem(id: string): FeedItem {
  const event: KibitzerEvent = {
    id,
    sessionId: SESSION,
    source: "claude-code",
    type: "tool_call",
    timestamp: "2026-08-30T10:00:00.000Z",
    detail: { tool: "Bash", command: "ls" },
  };
  return { event, dramaScore: 10, narration: null, audioUrl: null };
}

// Read the SSE body until `stop` returns true for the accumulated frames, then abort so the
// long-lived stream doesn't hang the test. Returns the parsed frames in arrival order.
async function readFrames(
  res: Response,
  stop: (frames: { event: string; data: string }[]) => boolean,
): Promise<{ event: string; data: string }[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const frames: { event: string; data: string }[] = [];
  let buf = "";
  while (!stop(frames)) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const ev = /^event:\s*(.*)$/m.exec(block)?.[1] ?? "";
      const data = /^data:\s*(.*)$/m.exec(block)?.[1] ?? "";
      if (ev) frames.push({ event: ev, data });
    }
  }
  await reader.cancel();
  return frames;
}

beforeAll(async () => {
  ({ pushFeedItem } = await import("../store.ts"));
  ({ streamRoutes: app } = await import("./stream.ts"));
  pushFeedItem(feedItem(`a-${SESSION}`));
  pushFeedItem(feedItem(`b-${SESSION}`));
});

describe("GET /events/stream", () => {
  // The ring is shared singleton state, so other test files may have pushed items too. We
  // assert the ORDERING contract (hello first, then replays) and that our two seeded items
  // appear as replay frames in order — not their absolute ring position.
  test("sends hello first, then replays the ring (our items in order)", async () => {
    const myIds = [`a-${SESSION}`, `b-${SESSION}`];
    const res = await app.request("/events/stream");
    const frames = await readFrames(res, (f) => {
      const seen = f.filter((x) => x.event === "replay" && myIds.includes(JSON.parse(x.data).event.id));
      return seen.length >= 2;
    });

    expect(frames[0].event).toBe("hello");
    // sessionId is whatever the newest ring item is (shared state); just assert it's present.
    expect(JSON.parse(frames[0].data)).toHaveProperty("sessionId");

    // Every frame after hello (up to our last seeded item) is a replay — no interleaving.
    const rest = frames.slice(1);
    expect(rest.every((f) => f.event === "replay")).toBe(true);

    const mine = rest
      .map((f) => JSON.parse(f.data).event.id)
      .filter((id: string) => myIds.includes(id));
    expect(mine).toEqual(myIds);
  });
});
