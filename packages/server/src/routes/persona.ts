// Owned by Unit B. Mounts GET/PUT /persona.
import { Hono } from "hono";
import type { PersonaFrame, PersonaKey } from "@kibitzer/shared";
import { getPersona, setPersona } from "../store.ts";
import { broadcast } from "../bus.ts";

export const personaRoutes = new Hono();

const PERSONAS: readonly PersonaKey[] = ["sports", "nature"];
const isPersona = (v: unknown): v is PersonaKey =>
  typeof v === "string" && (PERSONAS as readonly string[]).includes(v);

// Global persona state (single-session demo). Change affects FUTURE narration only.
personaRoutes.get("/persona", (c) => c.json({ persona: getPersona() }));

personaRoutes.put("/persona", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid persona", issues: ["malformed JSON body"] }, 400);
  }

  const persona = (body as { persona?: unknown } | null)?.persona;
  if (!isPersona(persona)) {
    return c.json(
      { error: "invalid persona", issues: ["persona must be 'sports' or 'nature'"] },
      400,
    );
  }

  setPersona(persona);
  const frame: PersonaFrame = { persona };
  broadcast("persona", frame);
  return c.json({ persona }, 200);
});
