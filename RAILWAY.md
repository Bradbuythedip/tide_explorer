# prevblock production deploy — Vercel + Railway hybrid

The shipping plan you actually picked: Vercel hosts the Next.js
frontend, Railway hosts everything stateful (Postgres, Redis,
backend, indexer), and your box hosts only `tidecoin-qt` exposed
through a Cloudflare Tunnel. Three dashboards, each managing the
one thing it's best at.

```
                    prevblock.com
                          │
                          ▼
                    ┌──────────┐
                    │  Vercel  │  Next.js frontend
                    │  (free)  │  (static + SSR)
                    └────┬─────┘
                         │ /api/v1/* rewrite
                         │ (BACKEND_INTERNAL_URL env)
                         ▼
                  api.prevblock.com
                         │
                         ▼
                ┌────────────────────┐
                │      Railway       │
                │   ($5/mo Hobby)    │
                │                    │
                │  ┌──────────────┐  │
                │  │   backend    │──┼──→ Postgres (managed)
                │  │  (Fastify)   │  │
                │  └──────┬───────┘  │
                │         │          │
                │         │          ├──→ Redis (managed)
                │  ┌──────▼───────┐  │
                │  │   indexer    │──┘
                │  └──────┬───────┘
                └─────────┼──────────┘
                          │
                          ▼
                tidecoin-rpc.prevblock.com
                  (Cloudflare Tunnel)
                          │
                          ▼
                      your box
                  ┌──────────────┐
                  │ tidecoin-qt  │
                  │   :7585      │
                  └──────────────┘
```

The whole thing costs $5/mo (Railway Hobby covers all four services
plus the managed Postgres and Redis), and your domain registration
is the rest.

## Order of operations

You must do these in this order or things break in ways that are
annoying to debug. Read the whole list once before starting.

| # | What | Where | Why first |
|---|---|---|---|
| 1 | Change tidecoind RPC password | your box | Before anything is exposed publicly |
| 2 | Install + configure cloudflared | your box | The backend on Railway needs this URL to come up |
| 3 | Verify tunnel from outside | anywhere | Confirms Railway can reach tidecoind |
| 4 | Create Railway project | Railway | Empty project we'll add services to |
| 5 | Provision Postgres + Redis | Railway | Their connection strings inject into the next two services |
| 6 | Deploy backend service | Railway | Frontend can't reach this URL until it exists |
| 7 | Deploy indexer service | Railway | Long catch-up; can run while you finish wiring |
| 8 | Add Vercel project env var | Vercel | Tells the frontend where the backend is |
| 9 | Redeploy Vercel | Vercel | Picks up the env var |
| 10 | Smoke test prevblock.com | anywhere | The acceptance gate |
| 11 | Wait for indexer + verify | anywhere | DIRECTIVE.md §10 — no personal numbers ship until verify is green |

---

## Step 1 — change the tidecoind RPC password

The current `satoshi:satoshi` was fine when tidecoind was
localhost-bound. The moment it's reachable through a tunnel — even
behind Cloudflare Access — that password is unacceptable. Do this
before anything else.

```bash
# Pick a strong password
NEW_PASS=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
echo "NEW RPC PASSWORD: $NEW_PASS"
echo "$NEW_PASS" > ~/.prevblock-rpc-password   # save somewhere you trust

# Edit your tidecoin conf — wherever it actually is
$EDITOR ~/.tidecoin/tidecoin.conf
# Change rpcpassword=satoshi to rpcpassword=$NEW_PASS
# (paste the actual value)

# Restart tidecoin-qt to pick up the change
# (close the GUI, then relaunch)

# Confirm from localhost
curl -fsS -u "satoshi:$NEW_PASS" \
  -H content-type:application/json \
  -d '{"jsonrpc":"1.0","id":"x","method":"getblockcount","params":[]}' \
  http://127.0.0.1:7585/
# {"result":<int>,"error":null,"id":"x"}

# Update the local backend's .env so dev still works
cd ~/prevblock
sed -i "s|^TIDECOIN_RPC_PASSWORD=.*|TIDECOIN_RPC_PASSWORD=$NEW_PASS|" .env
grep TIDECOIN_RPC_PASSWORD .env

# Restart your local backend if you have it running
```

## Step 2 — install Cloudflare Tunnel on your box

Full reference: [`deploy/cloudflared/install.md`](deploy/cloudflared/install.md). Compressed:

```bash
# Install
sudo mkdir -p /etc/cloudflared
curl -L --output /tmp/cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i /tmp/cloudflared.deb

# Authenticate (browser opens, pick the prevblock.com zone)
cloudflared tunnel login

# Create the tunnel
cloudflared tunnel create prevblock-tidecoind
# Note the UUID it prints — you'll need it twice below.
TUNNEL_UUID=<paste UUID>

# Drop in our config and replace the placeholders
sudo cp ~/prevblock/deploy/cloudflared/config.yml /etc/cloudflared/config.yml
sudo cp ~/.cloudflared/${TUNNEL_UUID}.json /etc/cloudflared/${TUNNEL_UUID}.json
sudo sed -i "s|REPLACE_WITH_TUNNEL_UUID|${TUNNEL_UUID}|g" /etc/cloudflared/config.yml

# Route DNS at the tunnel
cloudflared tunnel route dns prevblock-tidecoind tidecoin-rpc.prevblock.com
```

**If `cloudflared tunnel route dns` fails with "zone not managed by
Cloudflare":** prevblock.com is on Vercel's nameservers and Cloudflare
doesn't own the zone. Two paths:

- **A. Move DNS to Cloudflare** (recommended; gets you free DDoS
  protection too). In Cloudflare dashboard → Add a Site → enter
  prevblock.com → Cloudflare gives you two nameservers → set them as
  the authoritative NS in your Vercel domain settings. After
  propagation (~5 min), rerun the `route dns` command.
- **B. Add the CNAME manually in Vercel.** In Vercel → your project
  → Settings → Domains → DNS records, add:
    - Type: `CNAME`
    - Name: `tidecoin-rpc`
    - Value: `<TUNNEL_UUID>.cfargotunnel.com`

Then install cloudflared as a service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared       # active (running)
sudo journalctl -u cloudflared -n 30    # look for "Connection registered"
```

## Step 3 — verify the tunnel from outside your network

Use a phone on cellular, or SSH to any non-home machine:

```bash
NEW_PASS=<the password you set in step 1>

curl -fsS -u "satoshi:$NEW_PASS" \
  -H content-type:application/json \
  -d '{"jsonrpc":"1.0","id":"smoke","method":"getblockcount","params":[]}' \
  https://tidecoin-rpc.prevblock.com/
# {"result":<int>,"error":null,"id":"smoke"}
```

If this returns the tip height from the public internet, the tunnel
works and Railway will be able to reach your node. If it fails,
**stop and fix it before doing the Railway steps** — the backend
won't come up otherwise.

### Optional but recommended: Cloudflare Access

By default the tunnel hostname is publicly reachable and your only
defence is the RPC basic-auth password. Add an Access policy so
only Railway can hit it:

1. Cloudflare → Zero Trust → Access → Applications → Add an
   application → Self-hosted.
2. Application name: `tidecoin-rpc`. Domain:
   `tidecoin-rpc.prevblock.com`.
3. Policy: name `railway-only`, action `Service Auth`, include
   `Service Token`. Create a new token, copy
   `CF-Access-Client-Id` and `CF-Access-Client-Secret` somewhere
   safe — you'll set them as env vars on Railway in step 6.
4. Save.

The backend doesn't currently send those headers. If you want
Access enabled, tell me and I'll add a 5-line patch to
`packages/rpc-client/src/client.ts` that injects them when the env
vars are set.

## Step 4 — create the Railway project

1. Go to <https://railway.app/new> and sign in with GitHub.
2. Click **Deploy from GitHub repo** → pick `Bradbuythedip/tide_explorer`.
3. Railway will scan the repo and find the `pnpm-workspace.yaml`.
   It'll try to deploy a single service automatically — let it do
   whatever, we're going to delete that and create the real
   services next. Or skip the auto-deploy by closing the dialog.

You should now have an empty Railway project named after the repo.

## Step 5 — provision Postgres and Redis

Both are one click each:

1. In your Railway project, click **+ New** → **Database** →
   **Add PostgreSQL**. Wait ~30 seconds for it to provision.
2. Click **+ New** → **Database** → **Add Redis**. Same wait.

Railway gives each service an internal `DATABASE_URL` and `REDIS_URL`
that we'll reference from the backend and indexer services.

## Step 6 — deploy the backend service

1. **+ New** → **GitHub Repo** → pick `tide_explorer` again. Railway
   creates a second service from the same repo.
2. Open the new service → **Settings** tab.
3. **Service Name:** `prevblock-backend`
4. **Root Directory:** `/` (leave blank or set to `/`)
5. **Build Command:**
   ```
   pnpm install --frozen-lockfile && pnpm --filter @prevblock/shared --filter @prevblock/rpc-client build
   ```
6. **Start Command:**
   ```
   pnpm -C packages/backend exec tsx src/index.ts
   ```
7. **Watch Paths** (so docs-only commits don't trigger redeploys):
   ```
   packages/backend/**
   packages/shared/**
   packages/rpc-client/**
   railway.toml
   ```

8. **Variables** tab → add these, one per row:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `LOG_LEVEL` | `info` |
   | `TIDECOIN_RPC_URL` | `https://tidecoin-rpc.prevblock.com/` |
   | `TIDECOIN_RPC_USER` | `satoshi` |
   | `TIDECOIN_RPC_PASSWORD` | _the password you generated in step 1_ |
   | `CORS_ALLOWED_ORIGINS` | `https://prevblock.com,https://www.prevblock.com` |
   | `DATABASE_URL` | _click "Add Reference" → Postgres → `DATABASE_URL`_ |
   | `REDIS_URL` | _click "Add Reference" → Redis → `REDIS_URL`_ |

   The Reference picker injects the live internal URL of the
   managed services — you don't paste connection strings yourself,
   and they auto-update if Railway rotates them.

9. **Networking** tab → enable **Public Networking** → Railway
   gives you a `*.up.railway.app` URL. **Copy this URL.** This is
   the URL you'll point Vercel at in step 8.

10. Save settings → Railway redeploys automatically. Watch the
    deploy logs in the **Deployments** tab. You should see:
    - `pnpm install --frozen-lockfile` succeeding
    - `tsc -p tsconfig.json` building shared and rpc-client
    - `Server listening at http://0.0.0.0:<port>`

11. **Quick smoke test** from your terminal:
    ```bash
    BACKEND_URL=https://your-backend.up.railway.app
    curl -fsS $BACKEND_URL/healthz
    # {"ok":true}
    curl -fsS $BACKEND_URL/readyz
    # {"ok":true,"tipHeight":<int>}
    ```
    If `/readyz` returns 503, the backend can't reach the tunnel.
    Most likely cause: wrong RPC password, or Cloudflare Access
    blocking requests because you set it up but didn't pass the
    headers. Fix the env var or temporarily disable Access to
    confirm.

## Step 7 — deploy the indexer service

1. **+ New** → **GitHub Repo** → `tide_explorer` again. Third
   service from the same repo.
2. Settings:
   - **Service Name:** `prevblock-indexer`
   - **Root Directory:** `/`
   - **Build Command:**
     ```
     pnpm install --frozen-lockfile && pnpm --filter @prevblock/shared build
     ```
   - **Start Command:** Run migrations, then start the indexer.
     Railway runs both via `&&` so the indexer doesn't start
     against an unmigrated DB.
     ```
     pnpm -C packages/indexer exec tsx src/migrate.ts && pnpm -C packages/indexer exec tsx src/index.ts
     ```
   - **Watch Paths:**
     ```
     packages/indexer/**
     packages/shared/**
     sql/**
     railway.toml
     ```

3. Variables:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `LOG_LEVEL` | `info` |
   | `INDEXER_LOG_EVERY` | `1000` _(throttles catch-up to one log line per 1000 blocks; switches to per-block at tip)_ |
   | `INDEXER_POLL_INTERVAL_MS` | `5000` _(5 s instead of 1 s — saves tunnel bandwidth when caught up)_ |
   | `TIDECOIN_RPC_URL` | `https://tidecoin-rpc.prevblock.com/` |
   | `TIDECOIN_RPC_USER` | `satoshi` |
   | `TIDECOIN_RPC_PASSWORD` | _same as backend_ |
   | `DATABASE_URL` | _Reference → Postgres → `DATABASE_URL`_ |

4. **Networking** tab → leave **Public Networking** OFF. The
   indexer never accepts inbound HTTP. Railway treats it as a
   background worker.

5. Save → deploy. Watch logs. First successful run looks like:
   ```
   migrations done
   indexer sync starting
   indexed block height=0 ...
   indexed block height=1000 ...
   indexed block height=2000 ...
   ```

   At ~250 blocks/sec on Railway's storage, expect 3–6 hours of
   catch-up. Leave it running.

## Step 8 — set the Vercel env var

You bought `prevblock.com` through Vercel, so the project should
already exist. If not, import it now: Vercel → New Project → Import
`Bradbuythedip/tide_explorer` → Root Directory `packages/frontend`
→ Framework `Next.js`. The `vercel.json` at the repo root tells
Vercel to build `@prevblock/shared` first.

Then:

1. Vercel project → **Settings** → **Environment Variables**.
2. Add:

   | Key | Value | Environment |
   |---|---|---|
   | `BACKEND_INTERNAL_URL` | _the Railway backend URL from step 6.9_ | Production, Preview, Development |

3. Make sure your custom domain `prevblock.com` is set as the
   production domain under **Settings** → **Domains**. (If you
   bought through Vercel, this is auto-configured.)

## Step 9 — redeploy Vercel

Either push any commit, or in Vercel → Deployments → click the
three-dot menu on the most recent deploy → **Redeploy**. Without
this, the new env var isn't picked up.

Wait for the build to finish (~1 minute).

## Step 10 — smoke test prevblock.com

From any browser:

```
https://prevblock.com               → dashboard with KPIs from Railway
https://prevblock.com/genesis       → IEEE Spectrum headline + p2pk_falcon
https://prevblock.com/quantum       → live three-bucket donut + "indexer
                                       still catching up" banner if indexer
                                       isn't done yet
https://prevblock.com/richlist      → ordered correctly, "showing N of M"
https://prevblock.com/tx/<txid>     → mempool-style flow detail
https://prevblock.com/block/0       → genesis block detail
```

If the dashboard says "Backend not reachable":

- Vercel build logs: did `BACKEND_INTERNAL_URL` get baked in?
  (`echo $BACKEND_INTERNAL_URL` in the build phase will show it.)
- Railway backend logs: any 5xx? CORS rejection?
- `curl https://your-backend.up.railway.app/api/v1/status` from your
  laptop — does it work? If yes, it's a Vercel rewrite issue. If
  no, it's a Railway issue.

Common fix: Vercel sometimes caches the rewrite config across
deployments. Force a fresh build by deleting + re-adding the env
var, then redeploy.

## Step 11 — verify the indexer

Tail the Railway indexer service logs until it catches up. You'll
know it's done when the log lines flip from `"indexed block"` to
`"indexed block (tip)"`.

Then verify-index against the prod data. You can run the script
locally pointing at the Railway Postgres URL:

```bash
# Get the public Postgres URL from Railway dashboard:
#   Postgres service → Connect → Public Network → copy the URL
RAILWAY_DB="postgres://postgres:xxx@xxx.up.railway.app:5432/railway"

DATABASE_URL=$RAILWAY_DB \
TIDECOIN_RPC_URL=https://tidecoin-rpc.prevblock.com/ \
TIDECOIN_RPC_USER=satoshi \
TIDECOIN_RPC_PASSWORD=$NEW_PASS \
./scripts/verify-index.sh
```

Required final line: `ALL CHECKS PASSED`. If any check fails,
paste it to me and I patch.

Per `DIRECTIVE.md` §10, no UI ships personal numbers (My Tidecoin)
until this is green. The richlist, /quantum, and /address pages
already work without it — they're just incomplete until catch-up
finishes.

---

## Costs, in dollars

| Service | Plan | Cost |
|---|---|---|
| Vercel | Hobby (free) | $0 |
| Railway | Hobby | $5/mo |
| Cloudflare (DNS + Tunnel + Access) | Free | $0 |
| Domain (prevblock.com) | one-time + annual | yours already |
| **Total recurring** | | **$5/mo** |

The Railway $5/mo Hobby plan is "credit-based" — you pay for the
resources you use up to $5, then it stops billing for the month.
prevblock's four services together are well under that ceiling.

## What runs where, summary

| Service | Where | Restart on push? |
|---|---|---|
| Frontend (Next.js) | Vercel | Yes — Vercel auto-deploys on push to main |
| Backend (Fastify) | Railway | Yes — only when `packages/backend/**` or its deps change |
| Indexer | Railway | Yes — only when `packages/indexer/**` or its deps change |
| Postgres | Railway | Managed; never restarts on git push |
| Redis | Railway | Managed; never restarts on git push |
| tidecoin-qt | your box | Manual — restart it yourself if it crashes |
| cloudflared | your box | systemd auto-restart |

## Operational notes

- **Railway log dashboards charge by volume**, so the
  `INDEXER_LOG_EVERY=1000` setting is important during catch-up.
  Don't lower it.
- **Vercel ISR cache:** the frontend's server components use
  `force-dynamic`, so there's no Vercel-side cache. The only cache
  in the data path is the backend's Redis layer, which is
  bounded by the TTL policy in `packages/backend/src/lib/cache.ts`.
- **If your home internet drops**, the cloudflared daemon
  reconnects automatically. tidecoin-qt keeps running. The backend
  on Railway will start returning 502s on `/readyz` until the
  tunnel is back; the rest of prevblock keeps working from the
  Postgres cache.
- **If Railway redeploys mid-block**, the indexer's
  per-block-atomic transaction means no partial state. It picks up
  exactly where it left off via `last_indexed_height`.
- **First Railway deploy of either service** will take 3–5 minutes
  because Nixpacks has to download Node and build the workspace
  for the first time. Subsequent deploys are ~1 minute thanks to
  layer caching.
