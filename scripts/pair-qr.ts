// Prints a scannable pairing QR for the mobile app (the ngrok tunnel URL is the app's base).
// Usage:
//   bun run scripts/pair-qr.ts                 # auto-detect the running ngrok tunnel
//   bun run scripts/pair-qr.ts https://x.ngrok-free.app   # explicit URL
//
// Auto-detect queries ngrok's local API (http://127.0.0.1:4040/api/tunnels), so start
// `ngrok http 8787` first. QR rendering is delegated to `qrcode-terminal` via bunx — no
// project dependency (Unit Z owns only glue, not new deps).
import { spawn } from "node:child_process";

const NGROK_API = "http://127.0.0.1:4040/api/tunnels";

interface NgrokTunnel {
  public_url: string;
  proto: string;
}
interface NgrokTunnels {
  tunnels: NgrokTunnel[];
}

async function detectNgrokUrl(): Promise<string> {
  let body: NgrokTunnels;
  try {
    const res = await fetch(NGROK_API);
    if (!res.ok) throw new Error(`ngrok API ${res.status}`);
    body = (await res.json()) as NgrokTunnels;
  } catch {
    throw new Error(
      "Couldn't reach ngrok's local API (http://127.0.0.1:4040). " +
        "Start it first: `ngrok http 8787` — or pass the URL as an argument.",
    );
  }
  // Prefer the https tunnel; fall back to whatever's up.
  const https = body.tunnels.find((t) => t.public_url.startsWith("https://"));
  const url = https?.public_url ?? body.tunnels[0]?.public_url;
  if (!url) throw new Error("ngrok is running but exposes no tunnels yet.");
  return url;
}

/** Render a QR to the terminal via `bunx qrcode-terminal`, resolving on exit. */
function renderQr(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("bunx", ["qrcode-terminal"], { stdio: ["pipe", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`qrcode-terminal exited ${code}`)),
    );
    child.stdin.write(text);
    child.stdin.end();
  });
}

try {
  const arg = process.argv[2];
  const url = arg ?? (await detectNgrokUrl());

  console.log(`\nPairing URL: ${url}\n`);
  await renderQr(url);
  console.log("\nScan this in the Kibitzer app (or paste the URL above).\n");
} catch (err) {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
