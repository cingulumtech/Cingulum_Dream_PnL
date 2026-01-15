# Atlas2 Deploy Workflow

## Quick commands

```bash
make deploy
make rollback
```

## What the scripts do

### `scripts/build_frontend.sh`
- Installs dependencies with `npm ci`.
- Builds the Vite app with `VITE_API_URL=/api` by default.
- Fails if the bundle still contains stray `/auth` paths or references to `localhost:8000`.

### `scripts/deploy_gapserver.sh`
- Copies the `dist/` build to a new timestamped release in `/var/www/atlas-releases`.
- Switches `/var/www/atlas` symlink to the new release.
- Reloads nginx after a config test.
- Runs health checks against:
  - `https://atlas.cingulum.cloud/api/health`
  - `https://atlas.cingulum.cloud/`
  - `https://atlas.cingulum.cloud/api/openapi.json`

### `scripts/rollback_gapserver.sh`
- Repoints `/var/www/atlas` symlink to the previous release.
- Reloads nginx.

## Environment overrides

All scripts accept overrides via environment variables:

- `VITE_API_URL` (build)
- `DIST_DIR` (build/deploy)
- `RELEASES_DIR`, `WEB_ROOT`, `NGINX_SERVICE` (deploy/rollback)
- `HEALTH_URL`, `ROOT_URL` (deploy)

Example:

```bash
VITE_API_URL="https://atlas.cingulum.cloud/api" make deploy
```
