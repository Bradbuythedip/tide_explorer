# Cloudflare Tunnel for tidecoind

The whole RAILWAY.md walkthrough lives in the top-level RAILWAY.md.
This file is a quick reference for the cloudflared piece on its own.

## Why a tunnel and not a port-forward

You don't need a public IP, you don't need to open a port on your
router, you don't need to deal with NAT or your ISP rotating your
address, and Cloudflare gives you free auto-renewing TLS at the
edge. The tunnel daemon makes an outbound HTTPS connection to
Cloudflare and Cloudflare proxies inbound requests through it. The
result is `https://tidecoin-rpc.prevblock.com` reaching your local
`127.0.0.1:7585` with zero firewall changes.

## Install

```bash
sudo mkdir -p /etc/cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

## Authenticate to Cloudflare

```bash
cloudflared tunnel login
```

A browser window opens. Pick the `prevblock.com` zone. cloudflared
writes a cert to `~/.cloudflared/cert.pem`.

## Create the tunnel

```bash
cloudflared tunnel create prevblock-tidecoind
# Creates a UUID and writes credentials to ~/.cloudflared/<uuid>.json
```

Note the UUID — you'll paste it into `config.yml`.

## Drop in config.yml

```bash
sudo cp ~/prevblock/deploy/cloudflared/config.yml /etc/cloudflared/config.yml
sudo cp ~/.cloudflared/<uuid>.json /etc/cloudflared/<uuid>.json
sudo $EDITOR /etc/cloudflared/config.yml
# Replace the two REPLACE_WITH_TUNNEL_UUID placeholders
```

## Route DNS at the tunnel

```bash
cloudflared tunnel route dns prevblock-tidecoind tidecoin-rpc.prevblock.com
```

This creates a CNAME in the `prevblock.com` Cloudflare zone pointing
at the tunnel. If `prevblock.com` is on Vercel's nameservers (which
it is by default after you bought through Vercel), this won't work
out of the box — you'll need to either move DNS to Cloudflare or
add the CNAME manually in Vercel's DNS settings:

  CNAME  tidecoin-rpc  <uuid>.cfargotunnel.com

## Install as a system service

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

## Verify

From any other machine on the internet:

```bash
curl -fsS -u 'satoshi:NEW_STRONG_PASSWORD' \
  -H content-type:application/json \
  -d '{"jsonrpc":"1.0","id":"smoke","method":"getblockcount","params":[]}' \
  https://tidecoin-rpc.prevblock.com/
# {"result":<int>,"error":null,"id":"smoke"}
```

## Lock it down with Cloudflare Access (recommended)

The tunnel itself is private but the hostname is publicly reachable
once the DNS exists. Add a Cloudflare Access policy so only requests
carrying a valid service token can pass through:

1. Cloudflare dashboard → Zero Trust → Access → Applications → Add an
   application → Self-hosted.
2. Application name: `tidecoin-rpc`. Application domain:
   `tidecoin-rpc.prevblock.com`.
3. Add a policy: name `railway-only`, action `Service Auth`,
   include `Service Token`. Create a new token, copy the
   `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers — you'll
   set these as env vars on the Railway backend service so it can
   authenticate to your tunnel.
4. Save.

The Railway backend will then send those two headers on every RPC
request, Cloudflare validates them at the edge, and unauthenticated
requests get a 403 before they ever reach your tunnel daemon.
