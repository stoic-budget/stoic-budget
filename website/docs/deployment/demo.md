---
title: Public demo
description: A read-only demo instance behind a Cloudflare Tunnel, reseeded every night
---

The public demo lets anyone look around Stoic Budget without signing up. The login page fills in a shared account, a
strip across the top says it is a demo, and the server refuses every change: uploads, edits, sign-ups, password resets.
Every night the database is emptied and filled again, so the twelve months of sample data always end today.

## What visitors see

One workspace, a freelance design studio paid in euros:

- twelve months of bank statements, budgets, subscriptions, goals, a custom table and net worth;
- receipts with their scans, two of them waiting in Review;
- invoices (paid, open, overdue, draft) and bills to pay;
- a small crypto account imported from a Coinbase export;
- the advice computed from all of it.

What a visitor changes stays in their browser: theme, table layouts, closed guides. Everything else answers
"This is a demo: you can look around, but nothing can be changed".

## How it is locked

- `DEMO_MODE=true` turns on a global guard that runs before authentication. It answers reads, the few POSTs that only
  read (exports, previews, counts) and sign-in, refresh and sign-out, and refuses everything else with
  `403 DEMO_READ_ONLY`. An end-to-end test walks every route of the API, so a new endpoint is refused until someone marks
  it.
- Registration reports closed, and the shared account is an ordinary user, not an instance admin.
- Each login adds a session row; the nightly reset removes them with everything else.

## Server

A small VPS is enough: 2 vCPU, 4 GB RAM, 20 GB disk, Docker with the compose plugin. Nothing listens on a public port;
visitors reach the frontend through a Cloudflare Tunnel.

## Setup

1. Clone the repository on the server and create `.env` as in [Docker deployment](./docker.md), with fresh secrets.
   Then add:

   ```bash
   # Pin a release that contains seed:public-demo.
   IMAGE_TAG=vX.Y.Z
   # Only the tunnel talks to these; keep them off the public interface.
   BACKEND_PORT=127.0.0.1:3001
   FRONTEND_PORT=127.0.0.1:3000
   FRONTEND_URL=https://demo.example.com
   APP_URL=https://demo.example.com
   CORS_ORIGINS=https://demo.example.com
   # The shared account; the login page shows it to everyone.
   DEMO_USER_EMAIL=demo@example.com
   DEMO_USER_PASSWORD=pick-something-long
   CLOUDFLARE_TUNNEL_TOKEN=...
   ```

2. Create the tunnel in the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a tunnel →
   Cloudflared**. Copy the token into `CLOUDFLARE_TUNNEL_TOKEN`. Add two public hostnames, in this order:

   | Hostname | Path | Service |
   |---|---|---|
   | `demo.example.com` | `^/socket\.io` | `http://backend:3001` |
   | `demo.example.com` | (empty) | `http://frontend:3000` |

   The frontend proxies `/api` to the backend itself; only the live-update socket needs its own route.

3. Start the stack and seed it once:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.demo.yml pull
   docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
   ./scripts/demo-reset.sh
   ```

   The first seed downloads the twelve receipt scans from Wikimedia Commons, checks each against its checksum and keeps
   a smaller copy in the uploads volume; later resets reuse those copies.

4. Reset every night with a systemd timer:

   ```ini
   # /etc/systemd/system/demo-reset.service
   [Unit]
   Description=Reset the public demo
   After=docker.service

   [Service]
   Type=oneshot
   WorkingDirectory=/opt/stoic-budget
   ExecStart=/opt/stoic-budget/scripts/demo-reset.sh
   ```

   ```ini
   # /etc/systemd/system/demo-reset.timer
   [Unit]
   Description=Reset the public demo every night

   [Timer]
   OnCalendar=*-*-* 04:00:00 UTC
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```

   ```bash
   sudo systemctl enable --now demo-reset.timer
   ```

   The reset stops the backend, recreates the database, clears Redis, starts the backend (which migrates) and runs the
   seed. The demo is down for about a minute.

## Cloudflare protections

The guard keeps the database from growing; these keep the box from being flooded. All of them fit the free plan.

- **Rate limiting** (Security → WAF → Rate limiting rules): when the URI path starts with `/api/v1/`, 100 requests per
  10 seconds per IP, action Block for 10 seconds. The backend has its own limits behind it: 500 requests per minute per
  IP and 5 sign-ins per minute.
- **Bot Fight Mode** (Security → Bots): on.
- **Caching**: the frontend's JavaScript, CSS and fonts are cached by default. Leave HTML and `/api` uncached.
- If the demo is under a flood, **Under Attack Mode** puts a challenge in front of every visitor until you turn it
  off.

`TRUST_PROXY` is set to the private network in `docker-compose.demo.yml`, so the backend's own rate limit counts each
visitor's address rather than cloudflared's. Check it once in the backend log after the first visit.

## Receipt credits

The receipts are real scans from Wikimedia Commons, chosen because none shows a card number, a bank account, a loyalty
number or a person's name. Their dates in the demo are moved into its year; everything else is what each receipt prints.

| Receipt | Author | Licence |
|---|---|---|
| [Lidl, Aurich](https://commons.wikimedia.org/wiki/File:Lidl_Emsstra%C3%9Fe_receipt,_Aurich_(2019)_01.jpg) | Donald Trung Quoc Don | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| [ALDI, Hesel](https://commons.wikimedia.org/wiki/File:ALDI_Hesel_receipt,_Hesel_(2019)_01.jpg) | Donald Trung Quoc Don | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| [ALDI, Ebersberg](https://commons.wikimedia.org/wiki/File:Aldi-Quittung-2006.jpg) | Riquix | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| [IKEA Augsburg](https://commons.wikimedia.org/wiki/File:Ikea-Quittung-2009.jpg) | Riquix | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| [MediaMarkt Augsburg](https://commons.wikimedia.org/wiki/File:MediaMarkt-Quittung-2011.jpg) | Riquix | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| [Timmelsjoch toll](https://commons.wikimedia.org/wiki/File:Timmelsjoch-Hochalpenstrasse_%E2%80%94_Quittung_%C3%BCber_die_Zahlung_der_Maut_2021.jpg) | User:Mateus2019 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| [Neuhauser Augustiner](https://commons.wikimedia.org/wiki/File:Augustiner_Neuhausen_Rechnung_2020.JPG) | User:Mateus2019 | Public domain |
| [Saurüsselalm](https://commons.wikimedia.org/wiki/File:GER_%E2%80%94_Bayern_%E2%80%94_Oberbayern_%E2%80%94_Landkreis_Miesbach_%E2%80%94_Gemeinde_Bad_Wiessee_%E2%80%94_Saur%C3%BCsselalm_1_(vorl%C3%A4ufiger_Beleg)_2024-04-07_Mattes.jpg) | User:Mattes | Public domain |
| [Vogtlandbahn dining car](https://commons.wikimedia.org/wiki/File:Vogtlandbahn_%E2%80%94_Speisewagen_(Quittung)_2015.jpg) | Vogtlandbahn, scan by User:Mattes | Public domain |
| [Großglockner toll](https://commons.wikimedia.org/wiki/File:Gro%C3%9Fglockner-Hochalpenstra%C3%9Fe_Mautquittung_2020.JPG) | Großglockner-Hochalpenstraßen AG | Public domain |
| [Gerlos toll](https://commons.wikimedia.org/wiki/File:AUT_%E2%80%94_Salzburger_Land_%E2%80%94_Bezirk_Zell_am_See_%E2%80%94_Gemeinde_Krimml_(Gerlospass,_Quittung_f%C3%BCr_die_Zahlung_der_Maut)_2021..jpg) | Großglockner Hochalpenstraßen AG, repro by User:Mateus2019 | Public domain |
| [Konstanz–Meersburg ferry](https://commons.wikimedia.org/wiki/File:Autof%C3%A4hre_Konstanz%E2%80%93Meersburg_%E2%80%94_Fahrschein_2021.jpg) | Stadtwerke Konstanz | Public domain |

The demo shows the CC BY-SA scans shrunk to 1000 px wide and recompressed; that copy is under the same licence.
