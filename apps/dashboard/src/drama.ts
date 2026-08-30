// Drama score (0–100) → color, calm green through hot red. Mirrors the app's
// meter (mobile-app.md / ux-flow.md). Pure UI helper; the score itself comes
// from the `score` SSE frame.
export function dramaColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  // green (140°) → red (0°) as score climbs.
  const hue = 140 - (s / 100) * 140;
  return `hsl(${hue}, 72%, 46%)`;
}
