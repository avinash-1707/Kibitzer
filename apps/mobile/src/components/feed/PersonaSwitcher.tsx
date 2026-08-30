// Persona control (mobile-app.md §Feed / §Session controls). PUT <base>/persona
// affects FUTURE narration only. The server broadcasts a `persona` frame which the
// store applies as the source of truth; local `pending` is just an optimistic echo.
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { PersonaKey } from "@kibitzer/shared";
import { setPersona as putPersona } from "../../api";

const PERSONAS: PersonaKey[] = ["sports", "nature"];

export function PersonaSwitcher({
  base,
  active,
}: {
  base: string;
  active: PersonaKey | null;
}) {
  const [pending, setPending] = useState<PersonaKey | null>(null);
  const current = pending ?? active;

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {PERSONAS.map((p) => {
        const isActive = current === p;
        return (
          <TouchableOpacity
            key={p}
            style={[styles.btn, isActive && styles.btnActive]}
            disabled={pending !== null}
            onPress={() => {
              setPending(p);
              putPersona(base, p).finally(() => setPending(null));
            }}
          >
            <Text style={[styles.text, isActive && styles.textActive]}>{p}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#1a1a1a",
  },
  btnActive: { backgroundColor: "#fff", borderColor: "#fff" },
  text: { color: "#bbb", fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  textActive: { color: "#111" },
});
