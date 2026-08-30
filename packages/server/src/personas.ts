// STUB — owned by Unit A. Persona prompts live here (version-controlled, not inline).
// Unit A fills the real prompt strings from persona-prompts.md.
//
// NOTE: `PersonaKey` is FROZEN in @kibitzer/shared — import it, do NOT re-declare it here
// as `keyof typeof PERSONAS` (that would shadow the shared type and diverge).
import type { PersonaKey } from "@kibitzer/shared";

export const PERSONAS: Record<PersonaKey, { label: string; system: string }> = {
  sports: { label: "Sports commentator", system: "" },
  nature: { label: "Nature documentarian", system: "" },
};
