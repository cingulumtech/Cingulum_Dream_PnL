# Accounting Atlas — Cingulum Health (MVP)

This is a working MVP that:
- Parses **Xero Profit & Loss** exports (`.xlsx`)
- Parses **Xero General Ledger Detail** exports (`.xlsx`, grouped by account like your file)
- Re-expresses Xero data into a **built-in Accounting Atlas** structure (board / investor view)
- Lets users **map Xero accounts → Atlas lines** with a fast, iPhone-like toggle UX
- Lets users **edit the Atlas layout** (add/remove/rename/reorder groups/lines) and export/import template JSON
- Supports **drill-down to transactions** (if GL is loaded) from either an Atlas line or a raw Xero account
- Includes a **simple replacement scenario** (remove legacy TMS revenue via matchers; add simulated bundle revenue + COGS)

## Run locally

### Backend (API + Postgres)

1) Start Postgres
```bash
docker compose up -d
```

2) Set environment variables
```bash
cp .env.example .env
```
Update `ALLOWED_SIGNUP_CODES` in `.env` to control who can register (single code or comma-separated list). Defaults to `invite-code-2657` if not set.
The first registered user is assigned `super_admin`; all later users default to `viewer` until upgraded in Settings.

To enable direct Xero syncs, add the following to `.env` (values supplied by Xero):
```bash
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
XERO_REDIRECT_URI=https://atlas.cingulum.cloud/api/xero/callback
```
Optional: `XERO_SCOPES` to override the default OAuth scopes.

In the Xero developer portal, make sure you register:
- **Company / Application URL**: `https://atlas.cingulum.cloud`
- **Redirect URI**: `https://atlas.cingulum.cloud/api/xero/callback`

3) Create a virtualenv + install backend deps
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
If your system is missing venv tooling, install it first: `sudo apt install python3-venv` (or `python3-full` on Ubuntu 24.04).

4) Run migrations
```bash
alembic upgrade head
```

5) Start the API (loads `.env` from the repo root automatically)
```bash
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

1) Install dependencies
```bash
npm install
```

2) Start
```bash
npm run dev
```

Open: `http://localhost:5173`

Note: do not install the Ubuntu `vite` package. Use the project-local Vite that ships in `node_modules` via `npm run dev` (or `npx vite` if needed).

### Tests

Backend tests (auth + snapshot RBAC):
```bash
cd backend
pytest
```

## Production deploy notes

- **Frontend must call same-origin `/api`** in production. Do **not** set `VITE_API_URL` to `http://localhost:8000` for builds.
- Use the guardrail build script to verify no localhost references are baked into `dist`:
```bash
npm run build:prod
```
- Use `scripts/deploy.sh` for repeatable installs + migrations + restarts (overridable via `WEB_SERVICE` / `API_SERVICE` env vars).

### Copy/paste: update production on the fly (keeps external build/runtime)

If your live deployment builds/runs **outside of git** (e.g., a separate working directory):
```bash
SRC_DIR=/path/to/Cingulum_Dream_PnL/mvp6
LIVE_DIR=/path/to/live/deployment

cd "$SRC_DIR"
git pull

rsync -av --delete \
  --exclude node_modules \
  --exclude backend/.venv \
  --exclude backend/__pycache__ \
  --exclude dist \
  "$SRC_DIR/" "$LIVE_DIR/"

cd "$LIVE_DIR"
./scripts/deploy.sh
```

If you need to override service names:
```bash
SRC_DIR=/path/to/Cingulum_Dream_PnL/mvp6
LIVE_DIR=/path/to/live/deployment

cd "$SRC_DIR"
git pull

rsync -av --delete \
  --exclude node_modules \
  --exclude backend/.venv \
  --exclude backend/__pycache__ \
  --exclude dist \
  "$SRC_DIR/" "$LIVE_DIR/"

cd "$LIVE_DIR"
WEB_SERVICE=atlas2-web.service API_SERVICE=atlas2-api.service ./scripts/deploy.sh
```

## How the “built-in upload” atlas works

The app does not depend on a fixed Cingulum sheet structure.
Instead, it builds a **canonical model** from the raw Xero export:

- `parseXeroProfitAndLoss()` outputs:
  - months (keys + labels)
  - a flat list of accounts with values per month, tagged with a best-effort section

- The Accounting Atlas P&L is:
  - **a template** (groups + lines)
  - each line keeps `mappedAccounts: string[]` (Xero account names)
  - computed values = `SUM(account values for mapped accounts)`

So once a user maps accounts once, the Atlas “just works” for future exports from that org.

## Files worth reading

- `src/lib/xero/plParser.ts` – robust P&L parser (finds header row, infers months, reads account rows)
- `src/lib/xero/glParser.ts` – GL parser for grouped-by-account exports
- `src/lib/dream/template.ts` – built-in Atlas template (editable in UI)
- `src/components/MappingEditor.tsx` – the iPhone-like mapping UX
- `src/components/TemplateEditor.tsx` – the layout editor

## Adapting to other Xero export variants

The parser is intentionally defensive, but Xero exports can vary.
If you encounter a new variant, you usually update only:
- `src/lib/xero/plParser.ts` (header detection + month columns)
- `src/lib/xero/glParser.ts` (account grouping rules / column headers)

The rest of the app stays unchanged because it consumes the canonical model.

## Next iteration (obvious improvements)

- Multi-entity / multi-file dataset manager (saved runs)
- “Unmapped account resolver” flow (guided)
- Better scenario modelling: project counts from GL, not manual inputs
- Rules-based mapping (regex rules per Dream line) + auto mapping library
- Export Accounting Atlas outputs to PDF / Excel
