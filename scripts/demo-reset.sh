#!/usr/bin/env bash
# Puts the public demo back to its seeded state: an empty database, the
# migrations, then seed:public-demo with today as the end of its year. Run by
# the host's timer every night (website/docs/deployment/demo.md) and once by
# hand after the first `up`. Receipt images stay in the uploads volume, so the
# reseed downloads nothing.
set -euo pipefail

cd "$(dirname "$0")/.."
# COMPOSE_FILE (in the environment or .env) names the files when a host adds
# its own override, e.g. other container names on a machine that runs more.
compose() {
  if [ -n "${COMPOSE_FILE:-}" ] || grep -qs '^COMPOSE_FILE=' .env; then
    docker compose "$@"
  else
    docker compose -f docker-compose.yml -f docker-compose.demo.yml "$@"
  fi
}

# The reset wipes the database, so it runs only where the demo account is the
# one account there: never against a real instance it was pointed at by mistake.
demo_email="${DEMO_USER_EMAIL:-}"
if [ -z "$demo_email" ] && [ -f .env ]; then
  demo_email="$(sed -n 's/^DEMO_USER_EMAIL=//p' .env | tail -n 1 | tr -d "\"'")"
fi
if [ -z "$demo_email" ]; then
  echo "DEMO_USER_EMAIL is not set (in the environment or .env); not resetting" >&2
  exit 1
fi

echo "Checking that the database holds no account but the demo's"
# The script runs in the postgres container, with its own variables; a fresh
# database, or one without tables yet, counts as empty.
others="$(compose exec -T -e DEMO_EMAIL="$demo_email" postgres sh -s <<'SH'
db="${POSTGRES_DB:-finflow}"
q() { psql -X -q -v ON_ERROR_STOP=1 -At -U "$POSTGRES_USER" "$@"; }
exists="$(echo "SELECT count(*) FROM pg_database WHERE datname = :'db'" | q -d postgres -v db="$db")"
[ "$exists" = 1 ] || { echo 0; exit 0; }
[ "$(q -d "$db" -c "SELECT to_regclass('public.users') IS NOT NULL")" = t ] || { echo 0; exit 0; }
echo "SELECT count(*) FROM users WHERE lower(email) <> lower(trim(:'email'))" | q -d "$db" -v email="$DEMO_EMAIL"
SH
)" || {
  echo "Could not check the accounts in the database; not resetting" >&2
  exit 1
}
if [ "$others" != 0 ]; then
  echo "The database holds $others account(s) besides $demo_email: this does not look like the demo." >&2
  echo "Not resetting. Point the script at the demo's own stack (COMPOSE_FILE, .env)." >&2
  exit 1
fi

echo "Stopping the backend"
compose stop backend

echo "Recreating the database"
# Single quotes on purpose: the variables are the postgres container's own.
# shellcheck disable=SC2016
compose exec -T postgres sh -c '
  db="${POSTGRES_DB:-finflow}"
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$db\" WITH (FORCE)" \
    -c "CREATE DATABASE \"$db\" OWNER \"$POSTGRES_USER\""'
# Cached answers and queued jobs belong to the old rows.
compose exec -T redis redis-cli FLUSHALL >/dev/null

echo "Starting the backend (it migrates on start)"
compose start backend
container="$(compose ps -q backend)"
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$container")"
  [ "$status" = "healthy" ] && break
  sleep 5
done
if [ "$status" != "healthy" ]; then
  echo "The backend did not become healthy (status: $status)" >&2
  exit 1
fi

echo "Seeding"
compose exec -T backend node dist/scripts/seed-public-demo.js
echo "Done"
