// Unit A "done when": a turn (activity + a turn_complete) narrated through runPipeline
// broadcasts score frames per event, then ONE narration→audio pair for the whole turn, and
// writes the mp3. Bare commands only score — narration waits for the turn to close.
// Both external calls (OpenRouter, ElevenLabs) are stubbed via a mocked fetch.
import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { KibitzerEvent } from "@kibitzer/shared";
import type { SSEStreamingApi } from "hono/streaming";
import { runPipeline } from "./pipeline.ts";
import { _resetTurnBuffers } from "./turnBuffer.ts";
import { addClient, removeClient } from "./bus.ts";
import { audioPath, isSafeEventId } from "./tts.ts";

const AUDIO_DIR = join(import.meta.dir, "..", "public", "audio");
const realFetch = globalThis.fetch;

type Frame = { event: string; data: unknown };

function fakeClient(sink: Frame[]): SSEStreamingApi {
  return {
    async writeSSE({ event, data }: { event?: string; data?: string }) {
      sink.push({ event: event ?? "", data: data ? JSON.parse(data) : null });
    },
  } as unknown as SSEStreamingApi;
}

// Stub both upstreams: OpenRouter returns a narration line, ElevenLabs returns mp3 bytes.
function stubFetch() {
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("openrouter.ai")) {
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "  And he ships it!  " } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("api.elevenlabs.io")) {
      return new Response(new Uint8Array([0x49, 0x44, 0x33]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  stubFetch();
  _resetTurnBuffers();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  _resetTurnBuffers();
});

const written: string[] = [];
afterAll(() => {
  for (const id of written) {
    const p = join(AUDIO_DIR, `${id}.mp3`);
    if (existsSync(p)) rmSync(p);
  }
});

function toolCall(detail: KibitzerEvent["detail"]): KibitzerEvent {
  return {
    id: crypto.randomUUID(),
    sessionId: "s-test",
    source: "claude-code",
    type: "tool_call",
    timestamp: new Date().toISOString(),
    detail,
  };
}

function turnComplete(): KibitzerEvent {
  return {
    id: crypto.randomUUID(),
    sessionId: "s-test",
    source: "claude-code",
    type: "turn_complete",
    timestamp: new Date().toISOString(),
    detail: { outcome: "success", message: "Ran the tests." },
  };
}

test("a bare tool_call only scores — narration waits for the turn to close", async () => {
  const frames: Frame[] = [];
  const client = fakeClient(frames);
  addClient(client);

  const e = toolCall({ tool: "Bash", command: "npm test", outcome: "failure" });
  await runPipeline(e);
  removeClient(client);

  // No turn boundary yet: scored + buffered, but silent.
  expect(frames.map((f) => f.event)).toEqual(["score"]);
});

test("a turn narrates ONCE for the whole turn and writes one mp3", async () => {
  const frames: Frame[] = [];
  const client = fakeClient(frames);
  addClient(client);

  // A couple of actions, then the turn closes.
  await runPipeline(toolCall({ tool: "Bash", command: "npm test", outcome: "failure" }));
  await runPipeline(toolCall({ tool: "Edit", filePath: "src/x.ts" }));
  const end = turnComplete();
  written.push(end.id);
  await runPipeline(end);
  removeClient(client);

  // Two score frames (one per event before the boundary), one score for the boundary event,
  // then a single narration→audio pair anchored on the turn_complete event.
  expect(frames.map((f) => f.event)).toEqual([
    "score",
    "score",
    "score",
    "narration",
    "audio",
  ]);

  const narration = frames.find((f) => f.event === "narration")!;
  const audio = frames.find((f) => f.event === "audio")!;
  expect(narration.data).toMatchObject({
    narration: "And he ships it!", // trimmed by narrate()
    audioUrl: null, // text lands before audio backfills
  });
  expect(audio.data).toMatchObject({
    eventId: end.id,
    audioUrl: `/api/tts?eventId=${end.id}`,
  });

  expect(existsSync(join(AUDIO_DIR, `${end.id}.mp3`))).toBe(true);
});

test("path-traversal eventIds are rejected before touching the filesystem", () => {
  for (const bad of ["../secret", "a/b", "..", "x".repeat(65), ""]) {
    expect(isSafeEventId(bad)).toBe(false);
    expect(audioPath(bad)).toBeNull();
  }
  expect(isSafeEventId(crypto.randomUUID())).toBe(true);
});

test("a Read event is scored but never contributes to narration", async () => {
  const frames: Frame[] = [];
  const client = fakeClient(frames);
  addClient(client);

  await runPipeline(toolCall({ tool: "Read", filePath: "x.ts" }));
  removeClient(client);

  expect(frames.map((f) => f.event)).toEqual(["score"]);
});

test("a size-flush then an empty turn_complete narrates ONCE, in order (no empty tail)", async () => {
  const frames: Frame[] = [];
  const client = fakeClient(frames);
  addClient(client);

  // 12 meaningful actions trigger the size-flush mid-turn...
  for (let i = 0; i < 12; i++) {
    await runPipeline(toolCall({ tool: "Edit", filePath: `src/f${i}.ts` }));
  }
  // ...then the turn actually closes right after, carrying no new work.
  const end = turnComplete();
  written.push(end.id);
  await runPipeline(end);
  removeClient(client);

  const kinds = frames.map((f) => f.event);
  // Exactly one narration/audio pair: the size-flush turn. The trailing empty turn_complete
  // is suppressed, so no second narration and narration precedes audio (ordered, no overlap).
  expect(kinds.filter((k) => k === "narration")).toHaveLength(1);
  expect(kinds.filter((k) => k === "audio")).toHaveLength(1);
  expect(kinds.indexOf("narration")).toBeLessThan(kinds.indexOf("audio"));
});
