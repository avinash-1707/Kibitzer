// Minimal leveled logger for the server. One place to format + gate all output so
// request logs and handler logs read the same. Levels are ordered; anything below
// LOG_LEVEL (default "info") is dropped. Set LOG_LEVEL=debug for verbose, =silent to mute.
type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const env = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (env === "silent") return Number.POSITIVE_INFINITY;
  return ORDER[env as Level] ?? ORDER.info;
}

// Read once at startup; a server restart picks up an env change.
const MIN = threshold();

function emit(level: Level, args: unknown[]): void {
  if (ORDER[level] < MIN) return;
  const ts = new Date().toISOString();
  const tag = `${ts} ${level.toUpperCase().padEnd(5)}`;
  // warn/error → stderr, so pipes/log shippers can split streams.
  const sink = level === "error" || level === "warn" ? console.error : console.log;
  sink(tag, ...args);
}

export const log = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
