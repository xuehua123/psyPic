#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/psypic/app}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.single-server.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
HEALTH_RETRIES="${HEALTH_RETRIES:-60}"
HEALTH_SLEEP_SECONDS="${HEALTH_SLEEP_SECONDS:-5}"
SKIP_GIT="${SKIP_GIT:-0}"

log() {
  printf '[deploy] %s\n' "$*"
}

fail() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

compose() {
  PSYPIC_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

has_service() {
  compose config --services | grep -qx "$1"
}

validate_environment() {
  [ -d "$APP_DIR" ] || fail "APP_DIR does not exist: $APP_DIR"
  cd "$APP_DIR"
  [ -f "$COMPOSE_FILE" ] || fail "compose file not found: $COMPOSE_FILE"
  [ -f "$ENV_FILE" ] || fail "env file not found: $ENV_FILE"

  if grep -q 'replace-with-' "$ENV_FILE"; then
    fail "$ENV_FILE still contains replace-with-* placeholders"
  fi
}

update_code() {
  if [ "$SKIP_GIT" = "1" ] || [ "$SKIP_GIT" = "true" ]; then
    log "git update skipped"
    return
  fi

  if [ ! -d .git ]; then
    log "not a git checkout; git update skipped"
    return
  fi

  log "updating git branch $BRANCH"
  git fetch origin
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
}

wait_for_health() {
  log "waiting for health: $HEALTH_URL"

  for attempt in $(seq 1 "$HEALTH_RETRIES"); do
    if curl -fsS "$HEALTH_URL" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
      log "health check passed"
      return
    fi

    log "health check not ready ($attempt/$HEALTH_RETRIES)"
    sleep "$HEALTH_SLEEP_SECONDS"
  done

  fail "health check did not pass"
}

main() {
  require_command git
  require_command docker
  require_command curl
  validate_environment
  update_code

  log "validating compose configuration"
  compose config >/dev/null

  log "starting data services"
  services="postgres redis"
  if has_service minio; then
    services="$services minio"
  fi
  compose up -d $services

  if has_service minio-init; then
    log "initializing MinIO bucket and app user"
    compose run --rm minio-init
  else
    log "MinIO initialization skipped"
  fi

  log "building app image"
  compose build app

  log "running database migrations"
  compose run --rm app pnpm prisma migrate deploy
  compose run --rm app pnpm prisma migrate status

  log "starting app"
  compose up -d app

  wait_for_health
  log "deployment complete"
}

main "$@"
