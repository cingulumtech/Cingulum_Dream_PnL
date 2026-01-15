#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${DIST_DIR:-$ROOT_DIR/dist}"
RELEASES_DIR="${RELEASES_DIR:-/var/www/atlas-releases}"
WEB_ROOT="${WEB_ROOT:-/var/www/atlas}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"
HEALTH_URL="${HEALTH_URL:-https://atlas.cingulum.cloud/api/health}"
ROOT_URL="${ROOT_URL:-https://atlas.cingulum.cloud/}"
OPENAPI_URL="${OPENAPI_URL:-https://atlas.cingulum.cloud/api/openapi.json}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
NEW_RELEASE="$RELEASES_DIR/atlas-$TIMESTAMP"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "Dist directory not found at $DIST_DIR. Run scripts/build_frontend.sh first." >&2
  exit 1
fi

if [[ ! -d "$RELEASES_DIR" ]]; then
  echo "Release directory $RELEASES_DIR missing." >&2
  exit 1
fi

CURRENT_RELEASE=""
if [[ -L "$WEB_ROOT" ]]; then
  CURRENT_RELEASE="$(readlink -f "$WEB_ROOT")"
fi

echo "==> Creating release $NEW_RELEASE"
mkdir -p "$NEW_RELEASE"

if [[ -n "$(ls -A "$NEW_RELEASE")" ]]; then
  echo "Release directory is not empty: $NEW_RELEASE" >&2
  exit 1
fi

echo "==> Syncing frontend assets"
rsync -a --delete "$DIST_DIR/" "$NEW_RELEASE/"

echo "==> Switching symlink to new release"
ln -sfn "$NEW_RELEASE" "$WEB_ROOT"

if command -v nginx >/dev/null 2>&1; then
  echo "==> Validating nginx config"
  nginx -t
  echo "==> Reloading nginx"
  systemctl reload "$NGINX_SERVICE"
fi

echo "==> Running health checks"
if ! curl -fsS "$HEALTH_URL" >/dev/null; then
  echo "Health check failed: $HEALTH_URL" >&2
  if [[ -n "$CURRENT_RELEASE" ]]; then
    echo "Rolling back to previous release: $CURRENT_RELEASE" >&2
    ln -sfn "$CURRENT_RELEASE" "$WEB_ROOT"
    systemctl reload "$NGINX_SERVICE" || true
  fi
  exit 1
fi

if ! curl -fsS "$ROOT_URL" >/dev/null; then
  echo "Health check failed: $ROOT_URL" >&2
  if [[ -n "$CURRENT_RELEASE" ]]; then
    echo "Rolling back to previous release: $CURRENT_RELEASE" >&2
    ln -sfn "$CURRENT_RELEASE" "$WEB_ROOT"
    systemctl reload "$NGINX_SERVICE" || true
  fi
  exit 1
fi

if ! curl -fsS "$OPENAPI_URL" >/dev/null; then
  echo "Health check failed: $OPENAPI_URL" >&2
  if [[ -n "$CURRENT_RELEASE" ]]; then
    echo "Rolling back to previous release: $CURRENT_RELEASE" >&2
    ln -sfn "$CURRENT_RELEASE" "$WEB_ROOT"
    systemctl reload "$NGINX_SERVICE" || true
  fi
  exit 1
fi

echo "==> Deployment successful: $NEW_RELEASE"
