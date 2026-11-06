---
title: Local Development
description: Run backend and frontend on your host
---

Use this workflow when you want to run the backend and frontend directly on your machine.

## Prerequisites

- Node.js 22.18+
- Docker with Compose v2 for PostgreSQL and Redis, or a local PostgreSQL 14+ and Redis 7 with
  `psql` and `redis-cli` on `PATH`

## One command

```bash
npm run setup:dev:local   # PostgreSQL + Redis in Docker, app on the host
npm run setup:dev:native  # local PostgreSQL + Redis, no Docker
```

`setup:dev:local` prepares the env files, starts PostgreSQL and Redis, installs missing npm
dependencies, runs migrations, seeds the demo user and starts both apps with `npm run dev`.

`setup:dev:native` does not use Docker. It expects PostgreSQL and Redis to be running, creates the configured
PostgreSQL role and database when your local Postgres user has permission, and verifies Redis. If a prerequisite is
missing, it stops before starting the app and names the missing tool, for example `redis-cli`.

The generated env points PostgreSQL to `localhost:5434` and Redis to `localhost:6379`. If your local PostgreSQL uses
the standard port, set `POSTGRES_PORT=5432` in `.env` and update `DATABASE_URL` in `backend/.env` before running
native mode.

## Step by step

### 1. Generate env files

```bash
npm run setup:env
```

This writes ignored `.env`, `backend/.env` and `frontend/.env.local` with a working `DATABASE_URL`
(port 5434), `REDIS_URL` and generated secrets. `backend/.env.example` and `backend/.env.all-options`
are references only — every value in `.env.example` is commented out.

### 2. Start dependencies

```bash
make db-start
```

This starts PostgreSQL and Redis with Docker Compose. It needs the root `.env` from step 1.

### 3. Start the backend API

```bash
npm --prefix backend install
npm --prefix backend run start:dev
```

The API runs at `http://localhost:3001/api/v1`. Migrations run on startup unless
`RUN_MIGRATIONS=false`; to run them by hand use `npm --prefix backend run migration:run:dev`.

### 4. Start the frontend

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

The web app runs at `http://localhost:3000`. The frontend server proxies `/api/*` and `/uploads/*`
to `API_PROXY_TARGET` (default `http://127.0.0.1:3001`), so the browser talks to one origin.

`npm run dev` at the repository root starts steps 3 and 4 together.

## Optional: seed demo data

```bash
npm --prefix backend run seed:demo:dev
```

## Troubleshooting

- **Docker daemon unavailable:** start Docker Desktop or Docker Engine, then rerun `npm run setup:dev`. The bootstrap
  script checks daemon reachability before running Compose.
- **Docker Compose command not found:** install Docker Compose v2. The bootstrap script prefers `docker compose` and
  falls back to `docker-compose` when available.
- **No Docker wanted:** run `npm run setup:dev:native` with local PostgreSQL and Redis already running. The script
  checks `psql` and `redis-cli` before touching the app.
- **Port already in use:** free ports `3000` and `3001` for local app mode. For PostgreSQL or Redis conflicts, change
  `POSTGRES_PORT` or `REDIS_PORT` in `.env`.
- **Reset local Docker data:** run `make clean`, then rerun `npm run setup:dev`.

Next: [Configuration](configuration)
