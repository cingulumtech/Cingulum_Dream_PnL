# Atlas2 Full Audit + Redeploy Plan

## Architecture (Current)

```
[ Browser ]
    |
    |  https://atlas.cingulum.cloud
    v
[ gapserver nginx ]
    |  / -> /var/www/atlas (symlink -> /var/www/atlas-releases/atlas-YYYYMMDD-HHMMSS)
    |  /api/* -> http://192.168.1.254:8000
    v
[ FastAPI backend on cingulum-sydney-cloud ]
```

## Confirmed root causes of `/auth/*` calls

- The frontend previously embedded explicit `/api/...` paths, but build artifacts have shown `/auth/...` strings. This points to inconsistent API base handling between builds and a lack of a single API base normalization.
- The production build can be created with an empty `VITE_API_URL`, which makes it easy to drift between absolute/relative paths or rely on ad-hoc rewrites.

## Functional/UI audit (by section)

### Auth/Login (AuthGate)
- **Intended:** login/register and invite-based access.
- **Current status:** calls `/api/auth/*` endpoints via centralized API client.
- **Issues:** no explicit health/test helper; auth path drift possible when baseURL changes.
- **Smallest fix:** normalize API base; add quick health/auth test helper (implemented).

### Overview
- **Intended:** executive summary, KPI deltas, and interactive drilldowns.
- **Current status:** data appears to be read from API-backed state and snapshot payloads.
- **Issues:** numerous controls rely on backend state, but there is no explicit load/error UI across all cards.
- **Smallest fix:** add consistent error/loading banners per module (future).

### Legacy P&L + Atlas P&L tables
- **Intended:** interactive financial tables with filters.
- **Current status:** uses in-memory state derived from backend payloads.
- **Issues:** no explicit empty-state guidance when GL/PL data is missing.
- **Smallest fix:** add empty-state CTA and disabled states (future).

### Mapping
- **Intended:** map source accounts to reporting layout.
- **Current status:** editing appears to modify local state; server sync triggers save.
- **Issues:** UX could warn on unsaved or failed saves.
- **Smallest fix:** surface `templateSaveStatus` clearly on the page (future).

### Layout (Template Editor)
- **Intended:** edit reporting layout rules and hierarchy.
- **Current status:** edits are saved through ServerSync.
- **Issues:** no standard success/error banner.
- **Smallest fix:** add consistent toast/banner for save status (future).

### Reports
- **Intended:** configure reporting and export settings.
- **Current status:** appears wired to backend state.
- **Issues:** status feedback depends on global save status only.
- **Smallest fix:** add inline success/error indicator at top of view (future).

### Snapshots
- **Intended:** CRUD snapshots + sharing.
- **Current status:** fully wired to backend with share management.
- **Issues:** lacks explicit optimistic loading indicators per action.
- **Smallest fix:** add disabled/loading state to share actions (future).

### Settings
- **Intended:** user preferences and defaults.
- **Current status:** saved to backend via ServerSync.
- **Issues:** no explicit save/error banner.
- **Smallest fix:** add banner to indicate saving state (future).

### Help
- **Intended:** documentation.
- **Current status:** static help content.
- **Issues:** none.

## Security + infrastructure issues

- **API base drift:** frontend bundle could contain `/auth/*` literals and depend on proxy rewrites.
- **Nginx config:** risk of multiple/conflicting server blocks; needs a single clean block with `/api/` proxy, SPA routing, cache headers, CSP.
- **CORS:** ensure same-origin via proxy and avoid wide-open CORS on backend.

## Proposed fixes (priority order)

1. **Normalize frontend API base** to always use `/api` in production and avoid `/auth/*` literals. (Implemented in `src/lib/api.ts`.)
2. **Single deploy workflow** with strict checks, rollback, and health checks. (Implemented via scripts + Makefile.)
3. **Nginx single server block** with correct headers, CSP, cache, and SPA routing. (Provided in `docs/nginx_atlas.conf`.)
4. **UX standardization**: add consistent save/error banners and empty states across sections.

## What changed and why

- Added frontend API base normalization + health/auth test helper to remove path drift.
- Added build/deploy/rollback scripts and Makefile targets to make redeploy safe and repeatable.
- Added audit and nginx config docs to document the production topology and deployment needs.

