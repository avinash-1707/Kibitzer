// Shared design tokens — the mobile equivalent of the web dashboard's CSS
// variables (apps/dashboard/src/styles.css). Mirrors those values so both
// surfaces read as one product: dark "broadcast console", signal-amber accent.
// Every screen/component should consume these instead of hardcoded hex/px.

export const colors = {
  // ---- surfaces (near-black, layered elevation) ----
  bg: "#08090c",
  panel: "#0f1116",
  panel2: "#161922",
  panel3: "#1d212c",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.16)",

  // ---- text ----
  text: "#edeff3",
  textDim: "#aab0bd",
  muted: "#767f8f",

  // ---- accent: signal amber — the "on air" color. Use sparingly. ----
  accent: "#ff8a3d",
  accentStrong: "#ffab6e",
  accentDim: "rgba(255, 138, 61, 0.14)",
  accentBorder: "rgba(255, 138, 61, 0.4)",
  accentGlow: "rgba(255, 138, 61, 0.5)",
  onAccent: "#1c0f04",

  danger: "#e0564b",

  // ---- event-source badges (categorical, distinct from the brand accent) ----
  source: {
    "claude-code": { bg: "#2a1c10", fg: "#f0a860" },
    opencode: { bg: "#14212f", fg: "#6fb4f6" },
    codex: { bg: "#1e1730", fg: "#b993f7" },
  } as Record<string, { bg: string; fg: string }>,
} as const;

// ---- spacing scale (4px base) ----
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

// ---- radius scale ----
export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

// ---- motion ----
export const duration = {
  fast: 120,
  base: 180,
  slow: 280,
} as const;

// ---- typography ----
// Display: Unbounded (loaded via expo-font in app/_layout.tsx) for brand,
// headers, and big numbers. Body/detail: platform system font + monospace,
// matching the app's existing convention ("Courier" for file paths) — the
// web's Hanken Grotesk/JetBrains Mono equivalents are close enough in feel
// (geometric grotesk body, monospace detail) without the added risk of
// loading two more font families on-device.
export const fonts = {
  displayBold: "Unbounded_700Bold",
  displaySemibold: "Unbounded_600SemiBold",
  displayExtraBold: "Unbounded_800ExtraBold",
  mono: "Courier",
} as const;

export const theme = { colors, spacing, radius, duration, fonts } as const;
