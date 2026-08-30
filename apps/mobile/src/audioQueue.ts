// Sequential on-device audio queue for narration clips.
// Gotcha (expo/expo#41852, #34162): creating a player per clip leaks and, after ~40
// create/remove cycles, players stop firing events unless you call BOTH .remove() and
// .release(). We avoid it: ONE long-lived player, .replace() its source per clip.
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from "expo-audio";

// Live commentary should be current, not complete: if TTS clips can't keep up with the
// feed, drop the oldest queued clips rather than drift arbitrarily behind.
const MAX_QUEUE = 3;
// A clip that never signals finish/error (404, hung load) must not stall the queue forever.
const CLIP_TIMEOUT_MS = 30_000;

export class AudioQueue {
  private player: AudioPlayer | null = null;
  private queue: string[] = [];
  private playing = false;
  private muted = false;
  private disposed = false;

  private ensurePlayer(): AudioPlayer {
    if (!this.player) this.player = createAudioPlayer(); // lazy: not at import time
    return this.player;
  }

  /** Queue a clip; starts draining if idle. Clips play strictly one after another. */
  enqueue(url: string) {
    if (this.disposed || this.muted) return;
    this.queue.push(url);
    while (this.queue.length > MAX_QUEUE) this.queue.shift(); // drop oldest
    if (!this.playing) void this.drain();
  }

  /** Drop everything pending (e.g. on session end). Doesn't stop the current clip. */
  clear() {
    this.queue = [];
  }

  /** Mute future clips and clear the backlog. Unmuting resumes with new arrivals. */
  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.clear();
  }

  private async drain() {
    // The synchronous run up to the first `await` sets `playing` before any second
    // `enqueue()` in the same tick can observe it — so this guard is not racy.
    this.playing = true;
    while (this.queue.length && !this.disposed) {
      const next = this.queue.shift()!;
      try {
        await this.playOne(next);
      } catch (err) {
        if (__DEV__) console.warn("[audioQueue] clip failed:", next, err);
      }
    }
    this.playing = false;
  }

  private playOne(url: string): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const player = this.ensurePlayer();
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const sub = player.addListener("playbackStatusUpdate", (s: AudioStatus) => {
        if (settled) return;
        if (s.error) finish(new Error(String(s.error)));
        else if (s.didJustFinish) finish();
      });
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        sub.remove(); // single teardown path — runs on finish, error, and timeout
        if (err) reject(err);
        else resolve();
      };
      timer = setTimeout(() => finish(new Error("clip timed out")), CLIP_TIMEOUT_MS);
      try {
        player.replace({ uri: url });
        player.play();
      } catch (err) {
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** Release native resources. Stops any in-flight drain first. Idempotent. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.queue = [];
    if (this.player) {
      this.player.remove();
      this.player.release(); // BOTH — required to avoid the leak above
      this.player = null;
    }
  }
}

/** App-wide singleton — the frozen `audioQueue.enqueue(url)` interface Wave-2 consumes. */
export const audioQueue = new AudioQueue();
