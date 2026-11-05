---
title: Public Demo Server
description: Run a free public demo on Oracle Cloud Always Free behind a Cloudflare Tunnel
---

A public demo lets anyone try Stoic Budget without signing up. Each visitor who opens `/try` gets a
throwaway guest account whose only workspace is the demo: twelve months of sample transactions, budgets,
goals and accounts in EUR. Guests are deleted with all their data after 24 hours.

This page sets one up for free: an Oracle Cloud **Always Free** virtual machine runs the regular Docker
stack, and a **Cloudflare Tunnel** gives it an HTTPS address without opening any port on the machine.

## How guest sessions work

`docker-compose.demo.yml` turns on `DEMO_GUESTS_ENABLED` for the backend. Then:

- `POST /api/v1/auth/demo` creates a guest (`guest-<uuid>@guest.demo.invalid`, a random password nobody
  sees), fills a demo workspace and signs the browser in with the usual httpOnly cookies. The frontend's
  `/try` page calls it and opens the dashboard.
- At most `DEMO_GUESTS_MAX` guests (default 200) live at once. Past that, `/try` asks the visitor to come
  back later (503). Each IP may start 3 guests a minute.
- Every hour the backend deletes guests older than `DEMO_GUEST_TTL_HOURS` (default 24) together with
  their workspaces.
- Without `DEMO_GUESTS_ENABLED=true` the route answers 404, so an ordinary install never hands out accounts.

Leave e-mail, IMAP, bank-sync and AI keys unset on a demo server: the features that need them then stay off,
and nothing a guest does can send mail or call a paid API.

## 1. Create the virtual machine

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/). A card is asked for to verify
   you; Always Free resources are not charged. The **home region** you pick cannot be changed later, and
   the free ARM machines are sometimes sold out in busy regions.
2. **Compute → Instances → Create instance**:
   - Image: **Ubuntu 24.04** (the aarch64 build).
   - Shape: **Ampere → VM.Standard.A1.Flex**, 2 OCPU and 12 GB of memory (the free allowance is 4 OCPU and
     24 GB in total).
   - Add your SSH public key, keep the public IP.
   - If creation fails with *Out of capacity*, try another availability domain or try again later.
3. Connect: `ssh ubuntu@<public-ip>`.

The images are published for both `amd64` and `arm64`. The free AMD micro machines (1 GB of memory) are
too small for the stack; use the ARM shape.

## 2. Install Docker and get the stack

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit   # log in again so the group applies
```

```bash
git clone https://github.com/stoic-budget/stoic-budget.git
cd stoic-budget
```

Guest sessions arrive with the first release that contains them. Until then, build the images on the
machine instead of pulling them: add `--build` to the `up` command below (the first build takes a while).

## 3. Create the Cloudflare Tunnel

You need a free Cloudflare account. A **stable address** needs a domain whose DNS is on Cloudflare; any
cheap domain works, added under **Websites → Add a domain**.

1. **Zero Trust → Networks → Tunnels → Create a tunnel**, type **Cloudflared**, any name.
2. On the install step, copy the token from the shown command (the long string after `--token`). That
   is `CLOUDFLARE_TUNNEL_TOKEN`; skip the install itself, the compose file runs cloudflared.
3. **Public hostname**: subdomain `demo`, your domain, service **HTTP** `frontend:3000`.

No domain yet? Skip this step and use a quick tunnel (see below): it gets a random
`*.trycloudflare.com` address that changes on every restart, fine for trying it out, not for a link on
your website.

## 4. Configure

Create `.env` in the repository root:

```bash
cat > .env <<EOF
POSTGRES_USER=seneca
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
INTEGRATIONS_ENCRYPTION_KEY=$(openssl rand -base64 32)
# Only the tunnel reaches the app: keep its ports on this machine.
BACKEND_PORT=127.0.0.1:3001
FRONTEND_PORT=127.0.0.1:3000
DEMO_URL=https://demo.example.com
CLOUDFLARE_TUNNEL_TOKEN=paste-the-token-here
EOF
```

Set `DEMO_URL` to the public hostname from step 3. Optional: `DEMO_GUESTS_MAX`, `DEMO_GUEST_TTL_HOURS`.

## 5. Start

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```

Open `https://demo.example.com/try`: after a few seconds you are on the dashboard of a fresh demo.
Point the website's **Try the demo** button at that `/try` address.

### Quick tunnel (no domain)

Leave `CLOUDFLARE_TUNNEL_TOKEN` out of `.env`, start with a quick tunnel and read the address it got:

```bash
CLOUDFLARED_COMMAND="tunnel --no-autoupdate --url http://frontend:3000" \
  docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
docker logs seneca-cloudflared 2>&1 | grep trycloudflare.com
```

Put that address in `DEMO_URL` and run the same `up -d` command again so the backend picks it up.

## Upkeep

- Logs: `docker compose -f docker-compose.yml -f docker-compose.demo.yml logs -f backend`
- Upgrade: `docker compose -f docker-compose.yml -f docker-compose.demo.yml pull`, then `up -d`.
- Guests alive right now:
  `docker exec seneca-postgres psql -U seneca -d finflow -c "select count(*) from users where email like '%@guest.demo.invalid'"`
