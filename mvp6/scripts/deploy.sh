#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

WEB_SERVICE="${WEB_SERVICE:-atlas-web.service}"
API_SERVICE="${API_SERVICE:-atlas-api.service}"

cd "$ROOT_DIR"

echo "==> Installing frontend dependencies"
npm ci

echo "==> Building frontend (same-origin API)"
npm run build:prod

echo "==> Installing backend dependencies"
if [[ ! -d "$ROOT_DIR/backend/.venv" ]]; then
  python3 -m venv "$ROOT_DIR/backend/.venv"
fi
source "$ROOT_DIR/backend/.venv/bin/activate"
pip install -r "$ROOT_DIR/backend/requirements.txt"

echo "==> Running migrations"
cd "$ROOT_DIR/backend"
alembic upgrade head
cd "$ROOT_DIR"
deactivate

echo "==> Restarting services"
systemctl restart "$WEB_SERVICE" "$API_SERVICE"
systemctl status "$WEB_SERVICE" "$API_SERVICE" --no-pager
