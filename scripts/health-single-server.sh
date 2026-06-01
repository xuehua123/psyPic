#!/usr/bin/env bash
set -Eeuo pipefail

HEALTH_URL="${HEALTH_URL:-https://staging.example.com/api/health}"

body="$(curl -fsS "$HEALTH_URL")"
printf '%s\n' "$body"

check() {
  pattern="$1"
  message="$2"

  if ! printf '%s\n' "$body" | grep -Eq "$pattern"; then
    printf 'Health validation failed: %s\n' "$message" >&2
    exit 1
  fi
}

check '"ok"[[:space:]]*:[[:space:]]*true' 'ok is not true'
check '"credentials"[^{]*\{[^}]*"status"[[:space:]]*:[[:space:]]*"configured"' 'credentials not configured'
check '"distinct_keys"[[:space:]]*:[[:space:]]*"configured"' 'credentials not distinct'
check '"auth_session"[^{]*\{[^}]*"store"[[:space:]]*:[[:space:]]*"database"' 'auth_session not database'
check '"workbench"[^{]*\{[^}]*"store"[[:space:]]*:[[:space:]]*"database"' 'workbench not database'
check '"storage"[^{]*\{[^}]*"driver"[[:space:]]*:[[:space:]]*"minio"' 'storage driver not minio'
check '"storage"[^{]*\{[^}]*"status"[[:space:]]*:[[:space:]]*"configured"' 'storage not configured'
