
export interface Env {
  INGEST_URL: string;
  TENANT_KEY: string;
  SAMPLE_RATE?: string;            // 0.0–1.0
  REDACT_HEADERS?: string;         // comma-separated
  SIGN_BODY?: string;              // "true" to enable HMAC signature
  REQUEST_TIMEOUT_MS?: string;     // e.g., "6000"
}

const UA = "cf-forwarder/1.2";
const RETRIES = 2; // total attempts = RETRIES + 1

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/__health") return new Response("ok", { status: 200 });

    const rate = clamp(Number(env.SAMPLE_RATE ?? "1.0"), 0, 1);
    if (Math.random() > rate) return new Response(null, { status: 204 });

    const redact = new Set(
      (env.REDACT_HEADERS ?? "authorization,cookie")
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
    );

    const forwardHeaders = new Headers(request.headers);
    for (const h of redact) if (forwardHeaders.has(h)) forwardHeaders.set(h, "__REDACTED__");
    forwardHeaders.set("x-tenant-key", env.TENANT_KEY);
    forwardHeaders.set("user-agent", UA);
    if (!forwardHeaders.get("content-type")) forwardHeaders.set("content-type", "application/json");

    // Optional HMAC signature over the body using TENANT_KEY
    const sign = (env.SIGN_BODY ?? "false").toLowerCase() === "true";
    let bodyForSend: ReadableStream | ArrayBuffer | null = request.body;
    let signature: string | null = null;

    if (sign) {
      const arr = await request.arrayBuffer();
      signature = await hmacSha256Hex(env.TENANT_KEY, new Uint8Array(arr));
      forwardHeaders.set("x-signature", signature);
      bodyForSend = arr;
    }

    const timeoutMs = Math.max(1, parseInt(env.REQUEST_TIMEOUT_MS || "6000", 10));

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort("timeout"), timeoutMs);
        const resp = await fetch(env.INGEST_URL, {
          method: "POST",
          headers: forwardHeaders,
          body: bodyForSend,
          redirect: "manual",
          cf: { cacheTtl: 0 },
          signal: controller.signal,
        });
        clearTimeout(id);

        if (resp.status >= 500 && attempt <= RETRIES + 1) {
          // retry on 5xx
        } else {
          return new Response(null, { status: resp.status });
        }
      } catch (err) {
        if (attempt > RETRIES + 1) {
          return new Response(null, { status: 524 }); // A timeout-like code
        }
      }
    }
  },
};

function clamp(n: number, min: number, max: number) { if (Number.isNaN(n)) return min; return Math.max(min, Math.min(max, n)); }

async function hmacSha256Hex(key: string, data: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
