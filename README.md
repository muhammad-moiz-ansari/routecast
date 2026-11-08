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

Celery now executes Phase 5 analysis jobs. Use separate terminals from backend after Docker is running:

```powershell
uv run --no-sync python manage.py runserver 127.0.0.1:8000
# Second terminal: local Windows development worker
uv run --no-sync celery -A config.celery:app worker --pool=solo --loglevel=info
# Third terminal: exactly one scheduler
uv run --no-sync celery -A config.celery:app beat --loglevel=info
```

Starting workers executes queued provider work; this is runtime usage, not an offline verification command. Windows solo is for local development; use a supported Linux worker environment for reliable soft/hard task time limits (configured 840/900 seconds). Beat runs one 60-second coordination task. No web-process background loop is started. Set ROUTECAST_LIVE_TEST_MODE=true in your existing backend/.env to disable background scheduling and Beat schedule; explicit queued trip analyses remain available. Do not overwrite existing environment files. Optional refresh/viewer/cooldown defaults are listed in backend/.env.example. HTTP client logging is capped at WARNING to avoid exposing credential-bearing provider URLs under Celery INFO logging.

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

## Phase 4 use

After weather prefetch, GET `/api/v1/trips/{id}/recommendation/` with the same owner session. This reads cached data only; it will not fetch weather or routes. It returns risk reasons/mileage, eligibility and a recommendation under the supplied rules, with incomplete/stale/blocked alternatives retained. Missing weather is visible and does not become Low risk. See docs/RISK_RULES.md for exact thresholds/load boundaries/ranking and docs/API_CONTRACT.md for result states.

No migration, dependency installation or environment change is required. New focused tests are in tests/test_phase4.py; consult the ledger and reuse unaffected existing checks. There is no frontend or background refresh in this phase, and no live provider check was necessary.

## Phase 5 use

POST /api/v1/trips/ now returns 202 with trip and analysis identifiers. A worker retrieves routes, builds checkpoints, prefetches weather, assesses risk and atomically publishes a completed analysis. Poll GET /api/v1/trips/{id}/analysis/ with ETags; polling never calls providers or maintains activity. Send owner/CSRF-protected heartbeat POSTs while actively viewing. Coordinated refresh and stop POSTs and full-input PATCH are documented in docs/API_CONTRACT.md. Completed data stays visible during failed refreshes and is marked stale when expired or input-mismatched. Reading recommendation/checkpoints/weather no longer recomputes against the current cache.

The new 0002 migration was applied to local PostgreSQL during implementation. Fresh checkouts still run the normal migrate setup. Historical trip viewer activity is expired by migration; a heartbeat/manual refresh is required to schedule old trips again. No new dependency installation is needed. Previous Phase 1–4 use sections are historical where they describe synchronous writes or direct weather acquisition.

New fake-clock/offline lifecycle acceptance tests: tests/test_phase5.py. Read the verification ledger before rerunning successful checks. Real Redis lease scripts and PostgreSQL publication/uniqueness were checked locally using rolled-back synthetic data. A real Celery broker/worker/Beat end-to-end run remains pending; no worker was started and no live provider test was run by the agent.

## Phase 6 use

GET `/api/v1/trips/{id}/corridor/` with the owner session returns independent corridor status and, when ready/partial, all 49 cached frames. Select slider hours locally from the arrays; GET and frame selection never fetch providers or change route recommendation. See docs/API_CONTRACT.md for indexing, missing masks, spatial approximation and clipping.

The new 0003 corridor migration was applied to local PostgreSQL during implementation. Existing real .env files were not changed. Optional CORRIDOR_WIDTH_MILES defaults to 10 miles on each side; provider request budgets and terms still apply. Initial visualization spacing is 10 miles along/10 miles across and is coarsened along long routes to stay at most 100 locations.

Corridor tasks use a separate `corridor` queue. Keep the core worker on `-Q celery` and start a separate corridor worker only when ready for runtime provider usage:

```powershell
uv run --no-sync celery -A config.celery:app worker -Q corridor --pool=solo --loglevel=info
```

Use the existing single Beat scheduler for bounded pending delivery recovery. As before, Windows solo is for local development; supported Linux workers provide reliable task time limits. No workers or Beat were started by the agent. Full broker/worker and live provider verification remain pending. Focused offline tests are in tests/test_phase6.py; read the ledger before repeating successful checks.

## Phase 7 frontend

The React planner now lives in frontend/. From that directory use `npm ci` then `npm run dev`; Vite serves the local planner and proxies /api to Django on port 8000. See [frontend setup](docs/FRONTEND_SETUP.md) for provider-free fixture mode, tests and browser checks. Browser environment variables never contain provider keys.

Phase 7 includes accessible place search, timezone-aware departure validation, cargo/spacing controls, day/night preferences, protected explicit submission and queued-processing feedback. Route comparison/map/timeline remain later phases. Backend services and prior verification were reused unchanged. `npm run build` produces local assets only; no publication/deployment is configured or performed.


Phase 8 adds route comparison, a MapLibre map and accessible checkpoint details. See docs/FRONTEND_SETUP.md for optional licensed day/night basemap configuration and offline comparison fixtures. Without configured style URLs, routes/checkpoints render in a clearly labeled geometry-only map. All risk and recommendation decisions come from the backend. Corridor timeline and full frontend refresh integration remain Phase 9.
