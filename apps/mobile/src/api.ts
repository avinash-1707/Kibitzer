// HTTP fetchers against the paired backend. Every call takes `base` (the ngrok URL);
// there is no CORS concern since the device treats <base> as the origin.
import type { Analytics, Devpost, PersonaKey } from "@kibitzer/shared";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${res.url}`);
  }
  return (await res.json()) as T;
}

/** GET /session/:id/analytics — Analytics tab fetches on mount and polls every ~5s. */
export function getAnalytics(base: string, sessionId: string): Promise<Analytics> {
  return fetch(`${base}/session/${encodeURIComponent(sessionId)}/analytics`).then(
    (r) => json<Analytics>(r),
  );
}

/** GET /persona — current global persona. `signal` lets pairing time out. */
export function getPersona(
  base: string,
  signal?: AbortSignal,
): Promise<{ persona: PersonaKey }> {
  return fetch(`${base}/persona`, { signal }).then((r) =>
    json<{ persona: PersonaKey }>(r),
  );
}

/** PUT /persona — change persona (affects future narration only). */
export function setPersona(
  base: string,
  persona: PersonaKey,
): Promise<{ persona: PersonaKey }> {
  return fetch(`${base}/persona`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ persona }),
  }).then((r) => json<{ persona: PersonaKey }>(r));
}

/** POST /session/:id/end — generate + return the devpost wrap-up. */
export function wrapUp(base: string, sessionId: string): Promise<Devpost> {
  return fetch(`${base}/session/${encodeURIComponent(sessionId)}/end`, {
    method: "POST",
  }).then((r) => json<Devpost>(r));
}

/** GET /session/:id/devpost — cached wrap-up; rejects (404) if not generated yet. */
export function getDevpost(base: string, sessionId: string): Promise<Devpost> {
  return fetch(`${base}/session/${encodeURIComponent(sessionId)}/devpost`).then((r) =>
    json<Devpost>(r),
  );
}

/**
 * Validate a candidate base URL during pairing: it must be a real http(s) URL
 * (QR content is untrusted) and answer GET /persona within 5s. Returns the
 * normalized (trailing-slash-stripped) URL, or throws.
 */
export async function validateBase(url: string): Promise<string> {
  const normalized = url.trim().replace(/\/$/, "");
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Not a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must be http or https");
  }
  await getPersona(normalized, AbortSignal.timeout(5000)); // throws on non-2xx / timeout
  return normalized;
}
