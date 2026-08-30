// Destructive-command classifier. Pure, unit-testable. Used by the server pipeline (step 0)
// as the sole source of truth for detail.isDestructive. Adapters never import this.

const DESTRUCTIVE = [
  /\brm\s+-rf\b/,
  /\bgit\s+push\s+.*--force\b/,
  /\bgit\s+push\s+-f\b/,
  /\bgit\s+reset\s+--hard\b/,
  // SQL only inside a db invocation, so "commit -m 'truncate log'" doesn't false-positive.
  /\b(sqlite3|psql|mysql)\b[^|;]*\b(DROP\s+TABLE|TRUNCATE)\b/i,
  /(^|\s)(>>?|tee|cat)\s+\S*\.env(\.|$|\s)/, // writing/reading .env via redirect/tee/cat
];

export function isDestructive(detail: {
  command?: string;
  filePath?: string;
}): boolean {
  const cmd = detail.command ?? "";
  if (DESTRUCTIVE.some((re) => re.test(cmd))) return true;
  if (detail.filePath && /(^|\/)\.env(\.|$)/.test(detail.filePath)) return true;
  return false;
}
