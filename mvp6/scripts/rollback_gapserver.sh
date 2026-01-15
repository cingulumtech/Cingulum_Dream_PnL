#!/usr/bin/env bash
set -euo pipefail

RELEASES_DIR="${RELEASES_DIR:-/var/www/atlas-releases}"
WEB_ROOT="${WEB_ROOT:-/var/www/atlas}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"

if [[ ! -L "$WEB_ROOT" ]]; then
  echo "Web root symlink not found at $WEB_ROOT" >&2
  exit 1
fi

CURRENT_RELEASE="$(readlink -f "$WEB_ROOT")"

mapfile -t RELEASES < <(ls -1 "$RELEASES_DIR" | sort)
if [[ ${#RELEASES[@]} -lt 2 ]]; then
  echo "Not enough releases to roll back." >&2
  exit 1
fi

CURRENT_NAME="$(basename "$CURRENT_RELEASE")"
PREVIOUS_RELEASE=""
for ((i=0; i<${#RELEASES[@]}; i++)); do
  if [[ "${RELEASES[$i]}" == "$CURRENT_NAME" ]]; then
    if [[ $i -eq 0 ]]; then
      echo "Current release is the oldest; no previous release available." >&2
      exit 1
    fi
    PREVIOUS_RELEASE="$RELEASES_DIR/${RELEASES[$((i-1))]}"
    break
  fi
done

if [[ -z "$PREVIOUS_RELEASE" ]]; then
  echo "Could not determine previous release." >&2
  exit 1
fi

echo "==> Rolling back to $PREVIOUS_RELEASE"
ln -sfn "$PREVIOUS_RELEASE" "$WEB_ROOT"

if command -v nginx >/dev/null 2>&1; then
  echo "==> Reloading nginx"
  systemctl reload "$NGINX_SERVICE"
fi

echo "==> Rollback completed"
