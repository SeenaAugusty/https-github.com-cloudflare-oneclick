
# Cloudflare One‑Click Deploy — Production Monorepo

This monorepo contains:

- **apps/worker** – a production‑hardened Cloudflare Worker that securely forwards logs/events to your ingestion endpoint (optional HMAC signature, sampling, redaction, retries, timeouts).
- **apps/site** – a Cloudflare Pages site with a Pages Function at `/api/ingest` that forwards to the Worker. Use a **route** to the Worker or set `WORKER_ENDPOINT` as a Pages Environment Variable.
- **.github/workflows** – GitHub Actions for one‑click deploys of the Worker and the Pages site.

> This repo favors a simple, reliable deploy story:
> - **Worker** is deployed via Wrangler in GitHub Actions.
> - **Pages** is deployed via Wrangler `pages deploy`.
> - Service Bindings can be added later in the Pages Project settings; by default we use an HTTP call to the Worker endpoint defined by route or workers.dev.

---

## Quick start (one‑click deploy)

### 1) Deploy the Worker
Run **Actions → Deploy Worker** and provide:

- `cf_account_id` – your Cloudflare Account ID
- `cf_api_token` – token with `Account.Workers Scripts:Edit`; add Zone scopes if attaching a route
- `ingest_url` – your HTTPS ingestion endpoint
- `tenant_key` – per‑customer/API key
- Optional: `cf_route` (e.g., `example.com/ingest/*`) and corresponding `cf_zone_id`

The workflow publishes the Worker and (optionally) attaches a route.

### 2) Deploy the Pages site
Run **Actions → Deploy Pages** and provide:

- `cf_account_id`, `cf_api_token`
- `pages_project` – your Pages Project name
- Optional: set `worker_endpoint` so the function knows where to send data (e.g., your Worker route or workers.dev URL). You can also set this later in the Pages project **Environment Variables** as `WORKER_ENDPOINT`.

### 3) Test
- `curl -i https://<your-domain-or-workers-subdomain>/__health` (Worker)
- `curl -i https://<your-pages-domain>/api/ingest` (should return 204/200 depending on sampling and upstream)

---

## Structure

```
cf-oneclick-monorepo-prod/
├─ .github/
│  └─ workflows/
│     ├─ deploy-worker.yml
│     └─ deploy-pages.yml
├─ apps/
│  ├─ worker/
│  │  ├─ src/
│  │  │  └─ index.ts
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ wrangler.toml
│  └─ site/
│     ├─ index.html
│     └─ functions/
│        └─ api/
│           └─ ingest.ts
└─ package.json
```

---

## Pages → Worker integration

This template forwards from **Pages Function** → **Worker** via HTTP. Configure one of:

1. **Route** to the Worker under your domain (recommended for production):
   - In the Worker deploy workflow, set `cf_route` (e.g., `example.com/ingest/*`) and `cf_zone_id`.
   - Set `WORKER_ENDPOINT=https://example.com/ingest` in the Pages Project **Environment Variables** (Production and Preview).

2. **workers.dev** URL (no custom domain):
   - After Worker deploy, copy its workers.dev URL.
   - Set `WORKER_ENDPOINT=https://<service>.<account>.workers.dev` in Pages Environment Variables.

> You can later switch to **Service Bindings** in the Pages project to avoid a public Worker URL.

---

## Secrets & Vars

- **Worker (Wrangler Vars):** `INGEST_URL`, `TENANT_KEY`, optional `SAMPLE_RATE`, `REDACT_HEADERS`, `SIGN_BODY` (true/false), `REQUEST_TIMEOUT_MS`.
- **Pages (Env Vars):** `WORKER_ENDPOINT` – base URL for the Worker (no trailing slash).

---

## Security hardening

- Optional HMAC signature header `x-signature` using `TENANT_KEY` when `SIGN_BODY=true`.
- Redacts inbound headers before forwarding (`authorization`, `cookie` by default).
- Sampling to reduce volume (`SAMPLE_RATE`).
- Timeouts & retries to keep tail latency predictable.

---

## Local dev (optional)

Install wrangler and run Workers locally if needed. Deploys should happen via Actions to preserve one‑click UX.

