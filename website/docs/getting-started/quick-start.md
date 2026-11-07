---
title: Quick Start
description: Run Stoic Budget locally with Docker in minutes
---

This guide gets you from zero to a running Stoic Budget stack using Docker Compose.

## Prerequisites

- Docker Desktop or Docker Engine with Compose v2 (`docker compose`)
- Node.js 22.18+ — the bootstrap script runs on the host
- Make (optional: `npm run setup:dev:docker` does the same thing)

Ports `3000` (frontend) and `3001` (backend) must be free.

## Start the stack

```bash
make quick-dev
```

This runs `npm run setup:dev:docker`, which:

- Writes `.env`, `backend/.env` and `frontend/.env.local` with development defaults and generated
  secrets, keeping any values you already set
- Builds and starts PostgreSQL, Redis, the backend and the frontend with hot reload
- Waits for `GET /api/v1/health/ready`
- Seeds the demo user

Database migrations run automatically when the backend starts.

## Other startup modes

`npm run setup:dev` asks which mode you want. To skip the question, start a mode directly:

| Mode | Command | Requirements | Best for |
|---|---|---|---|
| Interactive | `npm run setup:dev` | Node.js 22.18+; Docker optional depending on selected mode | First run; lets you choose a mode |
| Docker full-stack | `npm run setup:dev:docker` | Docker Desktop or Docker Engine with Compose | Fastest fresh-clone path |
| Local app + Docker infra | `npm run setup:dev:local` | Node.js 22.18+, npm, Docker Compose | Running backend/frontend on your host |
| Native no-Docker | `npm run setup:dev:native` | Node.js 22.18+, npm, local PostgreSQL, local Redis, `psql`, `redis-cli` | Contributors who do not want Docker |
| Env only | `npm run setup:env` | Node.js 22.18+ | Preparing `.env` files without starting services |

See [Local Development](local-development) for the modes that run the app on your host.

## Stop and restart

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

In `setup:dev:local` mode, press `Ctrl + C` in the terminal running it.

In Docker mode `node_modules` lives in named volumes, so a restart does not re-copy dependencies. When
`package-lock.json` changes, the container refreshes its `node_modules` on the next start by itself. `make clean`
drops those volumes for a from-scratch start.

## Log in

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/v1
- Swagger: http://localhost:3001/api/docs (not served when `NODE_ENV=production`)
- Demo credentials: `demo@seneca.dev` / `demo123`

PostgreSQL listens on `127.0.0.1:5434` and Redis on `127.0.0.1:6379`.

## Next steps

- Upload a statement from the Statements page
- Connect storage, mail or bank sync under **Integrations** — see [Integrations](../guides/integrations)
- Read [Configuration](configuration) before exposing Stoic Budget beyond localhost

Next: [Local Development](local-development)
