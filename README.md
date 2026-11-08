# RouteCast

Weather-aware truck route planning. Phase 0 provides backend infrastructure only; it does not yet plan trips or fetch forecasts. The frontend specification applies to phases 7–9. No frontend has been scaffolded.

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
