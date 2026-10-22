# Deploy קח כיוון (Kach Kivun)

| Part     | Where it runs                                   | URL                       |
| -------- | ----------------------------------------------- | ------------------------- |
| Frontend | Cloudflare Worker `tanstack-start-app`          | https://kachkivun.com     |
| API      | AWS EC2, Ubuntu, PM2 process `kachkivun-api`    | https://api.kachkivun.com |
| Database | MongoDB (connection string in the API's `.env`) |                           |

**Nothing deploys automatically.** Merging to `main` on GitHub changes nothing live. Each part is deployed by
hand, from `main` only. (`render.yaml` is from an earlier Render setup and is not used.)

---

## Before any deploy

Deploy only what is merged to `main`. Building from another branch puts that branch live: on 2026-10-22 a
deploy from `off-the-record` (51 commits behind `main`) took `/gibush` down until it was rolled back.

1. Merge the PR on GitHub.
2. When a change touches both sides, deploy the API first, then the frontend.

---

## API (AWS + PM2)

The server is `98.87.137.50` (what `api.kachkivun.com` points to). The SSH key lives outside the repo. Port 22
is open only to allowed IPs: if SSH times out, add your current IP to the instance's security group in the AWS
console (EC2 → Security Groups → inbound rule for port 22, "My IP").

```bash
ssh -i ~/Downloads/kachkivun-key.pem ubuntu@98.87.137.50
cd ~/mishlahat
git pull && npm ci --prefix server && pm2 restart kachkivun-api
```

Check:

```bash
pm2 ls                                    # kachkivun-api should be "online"
pm2 logs kachkivun-api --lines 50         # errors after the restart
curl -s https://api.kachkivun.com/api/health
```

After changing `server/.env`, restart with `pm2 restart kachkivun-api --update-env` so PM2 picks up the new values.

### Server environment (`~/mishlahat/server/.env`)

Never commit it. `server/.env.example` lists every key; the ones the API cannot run without:

| Key                               | What                                                  |
| --------------------------------- | ----------------------------------------------------- |
| `MONGODB_URI`                     | the database                                          |
| `JWT_SECRET`                      | at least 32 random chars (`openssl rand -base64 32`)  |
| `FRONTEND_URL`, `ALLOWED_ORIGINS` | `https://kachkivun.com` (no trailing slash)           |
| `ALLOWED_HOSTS`                   | `api.kachkivun.com`                                   |
| `OPENAI_API_KEY` and the AI keys  | matching                                              |
| `SMTP_*` or `RESEND_*`            | OTP emails                                            |
| `HEALTH_CHECK_TOKEN`              | same value as the GitHub secret the health check uses |

Payments stay off unless `PAYWALL_ENABLED=true`. Do not turn it on as part of a normal deploy: follow
`docs/PAYWALL_ROLLOUT.md` first.

---

## Frontend (Cloudflare Worker)

From a checkout of `main` on your machine, logged in to Wrangler (`npx wrangler login` once):

```bash
git checkout main && git pull
VITE_API_URL=https://api.kachkivun.com npm run deploy:web
```

`VITE_API_URL` is required: without it the build calls the wrong API and the role catalog does not load.

If your working folder is on another branch with uncommitted work, deploy from a separate worktree instead:

```bash
git worktree add ../kk-deploy origin/main     # once; later: cd ../kk-deploy && git fetch && git checkout --detach origin/main
cd ../kk-deploy && npm ci
VITE_API_URL=https://api.kachkivun.com npm run deploy:web
```

Check: https://kachkivun.com and https://kachkivun.com/gibush load.

### Roll back the frontend

Cloudflare keeps every version. To put the previous one back in seconds:

```bash
npx wrangler deployments list --name tanstack-start-app        # find the version id that was live before
npx wrangler rollback <version-id> --name tanstack-start-app
```

---

## Monitoring

`.github/workflows/daily-health.yml` checks the site, API, database, AI keys, email and SSL every hour and
posts to Slack when something breaks, plus a morning report.

---

## Cloudflare and origin lock

- Keep `kachkivun.com`, `www` and `api` proxied (orange cloud) in Cloudflare DNS, and a proxied wildcard
  `*.kachkivun.com` so subdomain scans hit Cloudflare, not the server.
- On the EC2 security group, allow 80/443 only from [Cloudflare's IP ranges](https://www.cloudflare.com/ips/),
  and 22 only from your IP.
- Keep the Cloudflare WAF managed rules on. The API also rate-limits (auth 5 per 15 min, API 100 per 15 min).

---

## Troubleshooting

| Problem                          | Fix                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| A page is 404 right after deploy | Deployed from the wrong branch. Roll back (above), then deploy from `main`.                      |
| CORS error in the browser        | `ALLOWED_ORIGINS` in `server/.env` must be exactly `https://kachkivun.com`, then `--update-env`. |
| The app calls the wrong API      | Rebuild with `VITE_API_URL=https://api.kachkivun.com` before `deploy:web`.                       |
| SSH times out                    | Your IP changed: update the port 22 rule in the EC2 security group.                              |
| `pm2 restart` asks for a name    | The process is `kachkivun-api` (`pm2 ls` lists it).                                              |
| OTP never arrives                | Check `SMTP_*` / `RESEND_*` in `server/.env`, and `pm2 logs kachkivun-api`.                      |
| Cloudflare upload "Retry-After"  | Rate limit: Wrangler waits and retries by itself. Let it finish.                                 |
