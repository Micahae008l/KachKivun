# Deploy קח כיוון (Kach Kivun) — subdomain setup

Keep the WordPress shop at **https://mike.haddad.co.il/** and run קח כיוון at:

| Service          | URL                              |
| ---------------- | -------------------------------- |
| Shop (unchanged) | `https://mike.haddad.co.il/`     |
| קח כיוון app     | `https://app.mike.haddad.co.il/` |
| קח כיוון API     | `https://api.mike.haddad.co.il/` |

You can use a dedicated subdomain (e.g. `app.mike.haddad.co.il`) — use the same hostname everywhere below.

---

## Who does what

### You (accounts, DNS, secrets)

1. **MongoDB Atlas** — free database in the cloud
2. **Render** — hosts the Express API (`server/`)
3. **Cloudflare** — hosts the React app (Workers) + DNS for subdomains
4. **DNS records** — point `api` and `app` at those services
5. **Secrets** — paste connection strings and API keys into Render (never commit them)

### Repo / agent (already done in code)

- `render.yaml` — one-click API deploy on Render
- CORS for `https://app.mike.haddad.co.il` via `FRONTEND_URL` / `ALLOWED_ORIGINS`
- `npm run deploy:web` — build + Cloudflare deploy
- `.env.production.example` — production `VITE_API_URL`

---

## Step 1 — MongoDB Atlas (you, ~10 min)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas/register) and create a free cluster.
2. **Database Access** → add a user with password.
3. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`) so Render can connect.
4. **Connect** → **Drivers** → copy the URI. Replace `<password>` with your user password.  
   Example: `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/kachkivun?retryWrites=true&w=majority`

Save this as `MONGODB_URI` — you will paste it into Render in step 2.

---

## Step 2 — API on Render (you, ~15 min)

1. Push this repo to **GitHub** (if it is not there yet).
2. Open [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect the GitHub repo. Render reads `render.yaml` and creates **kachkivun-api**.
4. In the service **Environment**, set (if not already):

   | Key                  | Value                                                                       |
   | -------------------- | --------------------------------------------------------------------------- |
   | `MONGODB_URI`        | your Atlas URI                                                              |
   | `JWT_SECRET`         | long random string (Render can generate one; or use `openssl rand -hex 32`) |
   | `ACCESS_TOKEN_TTL`   | `15m`                                                                       |
   | `REFRESH_TOKEN_DAYS` | `30`                                                                        |
   | `OPENAI_API_KEY`     | your OpenAI key                                                             |
   | `FRONTEND_URL`       | `https://app.mike.haddad.co.il`                                             |
   | `ALLOWED_ORIGINS`    | `https://app.mike.haddad.co.il`                                             |
   | `SMTP_*`             | optional — for real OTP emails (see `server/.env.example`)                  |

5. Wait until deploy is **Live**. Open the Render URL (e.g. `https://kachkivun-api.onrender.com/api/health`) — you should see `{"status":"ok",...}`.

6. **Custom domain on Render:** Service → **Settings** → **Custom Domains** → add `api.mike.haddad.co.il`. Render shows a **CNAME** target (e.g. `kachkivun-api.onrender.com`).

Payment remains fail-safe disabled in `render.yaml`. Do not enable it as part of a normal deploy.
Follow `docs/PAYWALL_ROLLOUT.md`, including legal/Grow review, real merchant details,
the dry-run grandfather migration, and production readiness check, before any live charge.

---

## Step 3 — DNS for API (you, at your domain host)

Where you manage `haddad.co.il` (WordPress host, registrar, or Cloudflare):

| Type  | Name  | Value                        |
| ----- | ----- | ---------------------------- |
| CNAME | `api` | the hostname Render gave you |

Wait a few minutes, then check: **https://api.mike.haddad.co.il/api/health**

---

## Step 4 — Frontend on Cloudflare (you + one local command)

### 4a. Cloudflare account

1. [dash.cloudflare.com](https://dash.cloudflare.com) → add site **`haddad.co.il`** (or only use Cloudflare for DNS if the domain is elsewhere).
2. If the domain is not on Cloudflare yet, change nameservers at your registrar to Cloudflare’s (they will show you which two).
3. Install Wrangler and log in (on your PC, in this repo):

   ```powershell
   cd C:\Users\Michael\Mishlahat
   npx wrangler login
   ```

### 4b. Build with production API URL

PowerShell:

```powershell
cd C:\Users\Michael\Mishlahat
$env:VITE_API_URL="https://api.mike.haddad.co.il"
npm run deploy:web
```

First deploy creates a `*.workers.dev` URL. Test it in the browser (login may hit your real API).

### 4c. Custom domain for the app

1. Cloudflare dashboard → **Workers & Pages** → your worker **tanstack-start-app**.
2. **Settings** → **Domains & Routes** → **Add** → `app.mike.haddad.co.il`.
3. If DNS is on Cloudflare, it often adds the record automatically. Otherwise add:

   | Type  | Name  | Value                             |
   | ----- | ----- | --------------------------------- |
   | CNAME | `app` | the worker route Cloudflare shows |

Open **https://app.mike.haddad.co.il** — the shop at the root domain is untouched.

---

## Step 5 — Smoke test (you)

1. `https://api.mike.haddad.co.il/api/health` → OK JSON
2. `https://app.mike.haddad.co.il` → landing page loads
3. Login with email → OTP (check Render logs if SMTP not set yet)
4. Complete onboarding → dashboard loads

---

## Origin lock (Cloudflare + Host allowlist)

Do this in the dashboard — code cannot orange-cloud your DNS for you.

1. **Proxy (orange cloud)** every public hostname (`kachkivun.com`, `www`, `api`) through Cloudflare. Do not publish the raw Render URL.
2. **Wildcard DNS:** add `*.kachkivun.com` → same Cloudflare proxied target (or a decoy) so subdomain brute-force hits CF, not your origin.
3. **Render env:** set `ALLOWED_HOSTS=api.kachkivun.com` so requests that still reach Render with `Host: *.onrender.com` get a uniform 404.
4. **JWT:** `JWT_SECRET` must be ≥32 random chars (`openssl rand -base64 32`). Weak defaults are rejected in production.
5. **Firewall / Authenticated Origin Pulls:** on hosts you control (VPS/AWS), allowlist [Cloudflare IP ranges](https://www.cloudflare.com/ips/) on 80/443 and drop the rest. On Render, prefer Cloudflare Tunnel or keep the onrender hostname secret + `ALLOWED_HOSTS` — Render does not expose iptables.
6. **WAF:** enable Cloudflare WAF managed rules; rate-limit is already in the API (`AUTH` 5/15m, `API` 100/15m) plus path-probe logging.

Already in the app (no extra work): httpOnly + Secure + SameSite=Strict refresh cookie, memory-only access JWT, probe path → identical 404, admin behind auth, IDOR scoped by `req.userId`, Mongoose (no string-built SQL).

---

## Redeploy after code changes

**API:** push to GitHub → Render auto-deploys.

**Frontend:**

```powershell
$env:VITE_API_URL="https://api.mike.haddad.co.il"
npm run deploy:web
```

---

## Troubleshooting

| Problem                      | Fix                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| CORS error in browser        | On Render, set `ALLOWED_ORIGINS` exactly to `https://app.mike.haddad.co.il` (no trailing slash). |
| API 503 / connection refused | Render service sleeping (free tier) — wait ~30s on first request; or upgrade plan.               |
| OTP never arrives            | Set `SMTP_*` on Render; until then, see OTP in **Render → Logs**.                                |
| App calls wrong API          | Rebuild with `VITE_API_URL=https://api.mike.haddad.co.il` before `deploy:web`.                   |
| MongoDB connection failed    | Atlas IP allowlist includes `0.0.0.0/0`; password in URI is URL-encoded.                         |

---

## Optional: use `kachkivun` instead of `app`

Use `kachkivun.mike.haddad.co.il` everywhere this doc says `app.mike.haddad.co.il`, and set the same URL in Render `FRONTEND_URL` and `ALLOWED_ORIGINS`.
