#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/psypic/app}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.single-server.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/opt/psypic/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

log() {
  printf '[backup] %s\n' "$*"
}

fail() {
  printf '[backup] ERROR: %s\n' "$*" >&2
  exit 1
}

compose() {
  PSYPIC_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

guard_backup_dir() {
  case "$BACKUP_DIR" in
    /opt/psypic/backups|/opt/psypic/backups/*|/var/backups/psypic|/var/backups/psypic/*)
      ;;
    *)
      fail "BACKUP_DIR must be under /opt/psypic/backups or /var/backups/psypic"
      ;;
  esac
}

main() {
  command -v docker >/dev/null 2>&1 || fail "missing required command: docker"
  [ -d "$APP_DIR" ] || fail "APP_DIR does not exist: $APP_DIR"
  cd "$APP_DIR"
  [ -f "$COMPOSE_FILE" ] || fail "compose file not found: $COMPOSE_FILE"
  [ -f "$ENV_FILE" ] || fail "env file not found: $ENV_FILE"

  guard_backup_dir
  mkdir -p "$BACKUP_DIR"

  local stamp
  stamp="$(date +%F-%H%M%S)"

  log "backing up PostgreSQL"
  compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' |
    gzip > "$BACKUP_DIR/psypic-db-$stamp.sql.gz"

  log "mirroring MinIO bucket"
  docker run --rm \
    --network psypic_net \
    --env-file "$APP_DIR/$ENV_FILE" \
    -e BACKUP_STAMP="$stamp" \
    -v "$BACKUP_DIR:/backup" \
    minio/mc:latest sh -c '
      mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null;
      mc mirror --overwrite local/"$ASSET_STORAGE_BUCKET" "/backup/minio-$BACKUP_STAMP";
    '

  log "rotating backups older than $RETENTION_DAYS days"
  find "$BACKUP_DIR" -type f -name 'psypic-db-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
  find "$BACKUP_DIR" -maxdepth 1 -type d -name 'minio-*' -mtime +"$RETENTION_DAYS" -exec rm -rf -- {} +

  log "backup complete: $BACKUP_DIR"
}

main "$@"
