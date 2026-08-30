// Unit A "done when": feeding a fake event through runPipeline broadcasts the
// three frames in order (score → narration → audio) and writes the mp3 to disk.
// Both external calls (OpenRouter, ElevenLabs) are stubbed via a mocked fetch.
import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { KibitzerEvent } from "@kibitzer/shared";
import type { SSEStreamingApi } from "hono/streaming";
import { runPipeline } from "./pipeline.ts";
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
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const written: string[] = [];
afterAll(() => {
  for (const id of written) {
    const p = join(AUDIO_DIR, `${id}.mp3`);
    if (existsSync(p)) rmSync(p);
  }
});

function ev(): KibitzerEvent {
  return {
    id: crypto.randomUUID(),
    sessionId: "s-test",
    source: "claude-code",
    type: "tool_call",
    timestamp: new Date().toISOString(),
    detail: { tool: "Bash", command: "npm test", outcome: "failure" },
  };
}

test("runPipeline broadcasts score → narration → audio in order and writes the mp3", async () => {
  const frames: Frame[] = [];
  const client = fakeClient(frames);
  addClient(client);

  const e = ev();
  written.push(e.id);
  await runPipeline(e);
  removeClient(client);

  expect(frames.map((f) => f.event)).toEqual(["score", "narration", "audio"]);

  const [score, narration, audio] = frames;
  expect(score.data).toMatchObject({ eventId: e.id });
  expect((score.data as { dramaScore: number }).dramaScore).toBeGreaterThan(0);
  expect(narration.data).toMatchObject({
    narration: "And he ships it!", // trimmed by narrate()
    audioUrl: null, // text lands before audio backfills
  });
  expect(audio.data).toMatchObject({
    eventId: e.id,
    audioUrl: `/api/tts?eventId=${e.id}`,
  });

  expect(existsSync(join(AUDIO_DIR, `${e.id}.mp3`))).toBe(true);
});

test("path-traversal eventIds are rejected before touching the filesystem", () => {
  for (const bad of ["../secret", "a/b", "..", "x".repeat(65), ""]) {
    expect(isSafeEventId(bad)).toBe(false);
    expect(audioPath(bad)).toBeNull();
  }
  expect(isSafeEventId(crypto.randomUUID())).toBe(true);
});

test("a Read event is scored but not narrated (debounce stops the pipeline)", async () => {
  const frames: Frame[] = [];
  const client = fakeClient(frames);
  addClient(client);

  const e: KibitzerEvent = { ...ev(), detail: { tool: "Read", filePath: "x.ts" } };
  await runPipeline(e);
  removeClient(client);

  expect(frames.map((f) => f.event)).toEqual(["score"]);
});
