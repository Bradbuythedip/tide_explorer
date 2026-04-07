# prevblock production deploy

This directory holds the configs you need to ship prevblock to
production at `prevblock.com` (frontend on Vercel) +
`api.prevblock.com` (backend + indexer on your own box).

## Files

- `systemd/prevblock-backend.service` — runs the Fastify API as a
  systemd unit, restart-on-failure, logs to /var/log/prevblock.
- `systemd/prevblock-indexer.service` — same for the indexer.
- `nginx/api.prevblock.com.conf` — TLS reverse proxy in front of the
  backend. Locks the public surface to /healthz, /readyz, and
  /api/v1/*; everything else 404s before reaching the backend.

## How everything fits together

```
prevblock.com           api.prevblock.com
       │                       │
       ▼                       ▼
    Vercel                 your box
   (Next.js)         ┌──────────────────────┐
       │             │ nginx (TLS)          │
       │ /api/v1/*   │   ↓                  │
       └────────────►│ backend (3001)       │
                     │   ↓                  │
                     │ postgres + redis     │
                     │   ↑                  │
                     │ indexer ─→ tidecoind │
                     └──────────────────────┘
```

The frontend's `next.config.mjs` rewrites `/api/v1/*` to whatever
`BACKEND_INTERNAL_URL` is set to in Vercel's project env. That URL
is `https://api.prevblock.com` in production. The browser never
sees it directly — Vercel does the rewrite at the edge.

## The order to ship in

See the top-level `RUNBOOK.md` §production for the full step-by-step.
Skeleton:

1. Lock down `.env` on your box: set `CORS_ALLOWED_ORIGINS` to
   `https://prevblock.com,https://www.prevblock.com`. Restart the
   backend after.
2. Move the backend and indexer from `tmux` to systemd via the
   units in this dir. Verify they survive a reboot.
3. Point an A record `api.prevblock.com` at your box's public IP.
4. Open port 443 in your firewall.
5. `sudo certbot --nginx -d api.prevblock.com` to get a cert.
6. Drop `nginx/api.prevblock.com.conf` into nginx, reload.
7. Verify `curl https://api.prevblock.com/healthz` from the
   internet returns `{"ok":true}`.
8. Connect the GitHub repo to Vercel, point at `packages/frontend`.
9. Set `BACKEND_INTERNAL_URL=https://api.prevblock.com` in Vercel
   project env.
10. Add `prevblock.com` as the production domain in Vercel.
11. Push to main → Vercel auto-deploys.
