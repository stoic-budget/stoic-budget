#!/usr/bin/env bash
# Puts the public demo back to its seeded state: an empty database, the
# migrations, then seed:public-demo with today as the end of its year. Run by
# the host's timer every night (website/docs/deployment/demo.md) and once by
# hand after the first `up`. Receipt images stay in the uploads volume, so the
# reseed downloads nothing.
set -euo pipefail

cd "$(dirname "$0")/.."
compose() { docker compose -f docker-compose.yml -f docker-compose.demo.yml "$@"; }

echo "Stopping the backend"
compose stop backend

echo "Recreating the database"
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
