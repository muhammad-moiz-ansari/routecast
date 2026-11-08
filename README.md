# RouteCast

Weather-aware truck route planning. Phase 2 builds on owner-scoped trips, place search and truck routes with distance checkpoints and arrival estimates. Weather assessment and frontend implementation remain later phases. The frontend specification applies to phases 7â€“9. No frontend has been scaffolded.

## Windows local setup (PowerShell)

Install Python 3.12, uv, and Docker Desktop with the WSL 2 backend and Linux containers. Start Docker Desktop and confirm `docker version` can reach its engine. Run from the repository root:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
# Keep the database credentials in both files aligned.
docker compose up -d --wait
Set-Location backend
$env:UV_CACHE_DIR = Join-Path (Split-Path $PWD) '.uv-cache'
uv sync --locked
uv run --no-sync python manage.py migrate
uv run --no-sync python manage.py runserver 127.0.0.1:8000
```

Copy example files only if the destination does not already exist. Never overwrite existing credentials. PostgreSQL and Redis bind to loopback only. The example password is for local development. If ports conflict, change the root Compose ports and corresponding backend connection settings.

Open [liveness](http://127.0.0.1:8000/api/v1/health/), [readiness](http://127.0.0.1:8000/api/v1/ready/), and [API documentation](http://127.0.0.1:8000/api/v1/docs). Readiness returns 503 when either local dependency is unavailable; liveness still returns 200. The docs UI uses Ninja's default CDN assets, so rendering it in a browser requires internet; its HTML and OpenAPI schema are available locally.

To stop infrastructure without deleting data, run `docker compose stop` from the root. PostgreSQL data lives in a named volume. No providers or scheduled jobs start with the web application.

## Offline verification

Read [the verification ledger](docs/VERIFICATION_LOG.md) before running checks. From `backend`, after syncing dependencies:

```powershell
uv run --no-sync python manage.py check
uv run --no-sync pytest
uv run --no-sync ruff check .
```

Tests block all socket connections, use SQLite and an in-memory cache, and inject readiness probes. They do not require Docker or API keys. PostgreSQL migrations are a separate local infrastructure check; do not represent SQLite evidence as PostgreSQL verification.

Celery is configured but has no tasks or Beat schedules. On Windows, a later manual worker smoke can use `uv run --no-sync celery -A config.celery:app worker --pool=solo`; Linux workers are preferred for deployment. Do not start Beat for Phase 0.

See [architecture](docs/ARCHITECTURE.md), [API contract](docs/API_CONTRACT.md), [decisions](docs/DECISIONS.md), and [progress](docs/PROGRESS.md). Secrets belong only in ignored environment files. No deployment is configured or authorized.

## Phase 1 use

Apply the new domain migration with `uv run --no-sync python manage.py migrate` from backend (Docker services running). The migration was applied to local PostgreSQL during implementation. Add TOMTOM_API_KEY to your existing backend/.env only when enabling live routing/search; no provider keys are required for offline tests, and runtime has no synthetic fallback. See docs/PROVIDER_SETUP.md for provider configuration and pending live evidence.

Bootstrap the session at GET /api/v1/session/, retain its cookies, then submit trip JSON to POST /api/v1/trips/ with the returned token in X-CSRFToken. Inspect your trip and stored routes using its UUID. See docs/API_CONTRACT.md for complete shapes/statuses. Phase 1 routes synchronously and returns 201; queued analysis belongs to Phase 5. There is no weather/risk recommendation yet.

New focused offline checks: `uv run --no-sync pytest tests/test_phase1.py`. Read the ledger first and repeat only checks affected by your changes. Existing Phase 0 helper/Redis/readiness evidence remains reusable.

## Phase 2 use

After creating a trip, read `/api/v1/trips/{id}/checkpoints/?route_id=A` with the same session cookie. Use an actual available route ID from its route options. The trip's stored spacing controls sampling. The response includes endpoints, intervals, arrival timestamps, analysis version and an explicit ETA method/fallback notice. Reads use stored geometry and timing only, without provider requests. Older Phase 1 snapshots work without a migration or refresh.

New route fetches ask for maneuver timing in the same TomTom request. Checkpoint placement uses measured full-polyline geometry scaled to provider route distance; this approximation and limits are documented in docs/API_CONTRACT.md. Weather/risk assessment is not yet implemented.

New focused offline checks: `uv run --no-sync pytest tests/test_phase2.py`. Existing verification is recorded in docs/VERIFICATION_LOG.md; do not repeat successful unrelated checks or refresh routes merely to view checkpoints. Phase 2 requires no dependency installation, database migration or environment change.

## Phase 3 use

POST `/api/v1/trips/{id}/weather/prefetch/` with the existing owner session and CSRF token to explicitly fetch live Open-Meteo hourly series for route checkpoints. GET `/api/v1/trips/{id}/weather/` returns cached matching without provider calls. These are weather/coverage results, not risk classifications. See docs/API_CONTRACT.md for units, boundary semantics and freshness. No migration, package install or environment change is required. Offline tests use HTTPX fixtures, never production fixture fallback.

Read the verification ledger before running the new focused tests: `uv run --no-sync pytest tests/test_phase3.py`. No live provider tests were run for Phase 3; provider contract evidence remains pending.
