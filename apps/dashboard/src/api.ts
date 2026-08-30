import type { Analytics, Devpost, PersonaKey } from "@kibitzer/shared";

// Same-origin fetchers; the Vite dev proxy forwards these to :8787.

export async function fetchAnalytics(sessionId: string): Promise<Analytics> {
  const res = await fetch(`/session/${encodeURIComponent(sessionId)}/analytics`);
  if (!res.ok) throw new Error(`analytics ${res.status}`);
  return res.json() as Promise<Analytics>;
}

export async function setPersona(persona: PersonaKey): Promise<PersonaKey> {
  const res = await fetch("/persona", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ persona }),
  });
  if (!res.ok) throw new Error(`persona ${res.status}`);
  const body = (await res.json()) as { persona: PersonaKey };
  return body.persona;
}

export async function getPersona(): Promise<PersonaKey> {
  const res = await fetch("/persona");
  if (!res.ok) throw new Error(`persona ${res.status}`);
  const body = (await res.json()) as { persona: PersonaKey };
  return body.persona;
}

export async function wrapUp(sessionId: string): Promise<Devpost> {
  const res = await fetch(`/session/${encodeURIComponent(sessionId)}/end`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`wrap-up ${res.status}`);
  return res.json() as Promise<Devpost>;
}
