// Owned by Unit A. Signatures FROZEN by Unit 0.
// ElevenLabs → mp3 at packages/server/public/audio/<eventId>.mp3, cache-first.
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

// Voice model. Default to the higher-quality conversational flagship (richer, more natural
// than flash v2.5, still ~280ms — fine for live narration). Override via ELEVENLABS_MODEL_ID;
// fall back to eleven_multilingual_v2 if your voice/plan rejects the v3 model.
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_v3_conversational";

// import.meta.dir === packages/server/src, so audio lives one level up in public/audio.
const AUDIO_DIR = join(import.meta.dir, "..", "public", "audio");

// eventId is a uuid v4 from the adapter; reject anything else so it can't be used
// to escape AUDIO_DIR via path traversal (../) when it reaches the filesystem.
const SAFE_EVENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Whether an eventId is safe to interpolate into a file path. */
export const isSafeEventId = (eventId: string): boolean =>
  SAFE_EVENT_ID.test(eventId);

const filePathFor = (eventId: string): string =>
  join(AUDIO_DIR, `${eventId}.mp3`);

// Prevents a double-generation race between the eager pipeline call and a
// concurrent GET /api/tts for the same event (architecture.md §7).
const inFlight = new Map<string, Promise<string>>();

/** Absolute path to a cached clip, or null if not yet generated (or unsafe id). */
export function audioPath(eventId: string): string | null {
  if (!isSafeEventId(eventId)) return null;
  const p = filePathFor(eventId);
  return existsSync(p) ? p : null;
}

/**
 * Generate (if needed) and return the on-disk path for an event's narration
 * audio. Cache-first: an existing mp3 is returned without re-billing ElevenLabs.
 * Concurrent calls for the same event share one in-flight generation.
 */
export async function synthesize(eventId: string, text: string): Promise<string> {
  if (!isSafeEventId(eventId)) throw new Error(`unsafe eventId: ${eventId}`);
  const cached = audioPath(eventId);
  if (cached) return cached;

  const existing = inFlight.get(eventId);
  if (existing) return existing;

  const job = generate(eventId, text).finally(() => inFlight.delete(eventId));
  inFlight.set(eventId, job);
  return job;
}

async function generate(eventId: string, text: string): Promise<string> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    },
  );
  if (!res.ok) {
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${res.statusText}`);
  }

  mkdirSync(AUDIO_DIR, { recursive: true });
  const path = filePathFor(eventId);
  // Write to a temp file then atomically rename, so a concurrent reader never
  // sees (and caches forever) a truncated mp3 from a streaming or aborted write.
  const tmp = `${path}.${crypto.randomUUID()}.part`;
  try {
    await Bun.write(tmp, res);
    renameSync(tmp, path);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return path;
}
