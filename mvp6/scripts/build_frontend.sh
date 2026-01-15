#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${DIST_DIR:-$ROOT_DIR/dist}"
API_BASE_URL="${VITE_API_URL:-/api}"

cd "$ROOT_DIR"

echo "==> Installing frontend dependencies"
npm ci

echo "==> Building frontend (API base: $API_BASE_URL)"
VITE_API_URL="$API_BASE_URL" npm run build

if [[ ! -d "$DIST_DIR" ]]; then
  echo "Build failed: dist directory not found at $DIST_DIR" >&2
  exit 1
fi

echo "==> Verifying bundle does not contain stray /auth paths"
if rg -n '"/auth/' "$DIST_DIR/assets" 2>/dev/null | rg -v '"/api/auth/' >/dev/null; then
  echo "Detected /auth paths in bundle that are not under /api." >&2
  rg -n '"/auth/' "$DIST_DIR/assets" 2>/dev/null | rg -v '"/api/auth/' >&2 || true
  exit 1
fi

if rg -n 'localhost:8000' "$DIST_DIR" >/dev/null 2>&1; then
  echo "Build failed: localhost:8000 found in build output" >&2
  exit 1
fi

echo "==> Frontend build completed at $DIST_DIR"
