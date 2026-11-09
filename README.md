# RouteCast

Weather-aware truck trip planning with React/TypeScript, Django Ninja/Pydantic, PostgreSQL, Redis and Celery. Phases 0–10 are implemented. Release configuration and an eight-minute walkthrough are prepared; nothing has been deployed. See [progress](docs/PROGRESS.md) and the [verification ledger](docs/VERIFICATION_LOG.md) for actual evidence and pending runtime checks.

Enter origin/destination, timezone-aware departure, cargo load in lb and checkpoint spacing (10/25/50 mi). The backend queues up to three distinct truck routes, estimates checkpoint arrivals, matches forecast intervals, applies weather/load rules and ranks eligible routes. The UI provides route inspection, accessible checkpoint details, cached 0–48-hour corridor layers, refresh/stop and stale/missing-data states. Forecast-hour selection does not change checkpoint-ETA recommendations.

## Windows development setup

Install Python 3.12, uv, a recent Vite-supported Node (24 used here), and Docker Desktop with WSL 2/Linux containers. Start Docker Desktop. From the root, copy examples only if destinations do not exist; keep database credentials aligned and never overwrite real environment files:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
docker compose up -d --wait
Set-Location backend
$env:UV_CACHE_DIR = Join-Path (Split-Path $PWD) '.uv-cache'
uv sync --locked
uv run --no-sync python manage.py migrate
uv run --no-sync python manage.py runserver 127.0.0.1:8000
```

In a separate terminal, from frontend:

```powershell
npm ci
npm run dev
```

For local live-backend testing, use `npm run dev:live` instead. It forces fixtures off even if the launching shell still has VITE_USE_FIXTURES=true. Stop the previous Vite server first; this command refuses to silently choose another port. Clear old synthetic origin/destination selections after restarting. Place suggestions appear after two characters and a 300 ms pause; choose a returned option rather than entering a full label manually.

Open http://127.0.0.1:5173 for the landing page, then choose **Plan a route** (or open /plan). Existing /trips/:id links retain the planner. Vite proxies /api to port 8000 with the original Host, preserving owner session/CSRF behavior. Local [health](http://127.0.0.1:8000/api/v1/health/), [readiness](http://127.0.0.1:8000/api/v1/ready/) and [API docs](http://127.0.0.1:8000/api/v1/docs) are available. Readiness checks only PostgreSQL/Redis; docs use external CDN resources locally and are disabled in production.

For real analyses add the server-only TOMTOM_API_KEY in your existing backend/.env and start separate terminals from backend:

```powershell
uv run --no-sync celery -A config.celery:app worker -Q celery --pool=solo --loglevel=info
uv run --no-sync celery -A config.celery:app worker -Q corridor --pool=solo --loglevel=info
# Exactly one scheduler; omit it when periodic runtime work is not intended.
uv run --no-sync celery -A config.celery:app beat --loglevel=info
```

Workers can execute queued provider work immediately. ROUTECAST_LIVE_TEST_MODE=true disables periodic scheduling but not explicit trip jobs. Windows solo is development-only; production uses Linux prefork for task time limits. The web process starts no scheduler/provider work by importing modules. Use `docker compose stop` to stop development infrastructure without deleting data.

## Offline preview and verification

For UI-only demonstration, set VITE_USE_FIXTURES=true in the frontend shell before `npm run dev`; open /trips/preview-trip. This explicitly labeled synthetic preview requires no Django, worker or provider. Clear that variable before a normal production build. See [frontend setup](docs/FRONTEND_SETUP.md) for scenarios, keyboard controls, preferences and local test tooling.

Read the ledger first and run only new/affected checks. Backend socket-blocked tests use SQLite/fakes; they are not PostgreSQL/broker/provider evidence. Examples from backend are `uv run --no-sync pytest tests/test_phase10.py` and `uv run --no-sync ruff check config/settings/production.py config/gunicorn.py api/app.py tests/test_phase10.py`. Frontend `npm run build` checks dependency notices, TypeScript and production output; focused Vitest cases are documented in the ledger. Do not reinstall dependencies or rerun successful provider checks merely for a demo or phase change.

## Release preparation

[Deployment runbook](docs/DEPLOYMENT.md) covers the standalone compose.production.yaml, production secrets/hosts, immutable image inventory, private same-origin Nginx/Gunicorn, static SPA delivery, backup/migration order, separate workers, one Beat, rollback and HTTPS verification. Copy .env.production.example privately only when preparing an authorized release. The development Compose file publishes loopback dependency ports; never merge it into production. No static-only host can run this architecture, and no free always-on hosting claim is made.

Docker/image/hosted smoke evidence remains pending in this environment. Release is prepared for a controlled noncommercial assessment behind authenticated HTTPS ingress. The existing public Open-Meteo adapter is not configured for commercial/customer endpoints. Aggregate gateway admission limiting and recorded weather usage are not daily provider/owner hard quotas; unrestricted public use needs further controls. See [provider setup](docs/PROVIDER_SETUP.md), [missing live checks](docs/LIVE_API_CHECKLIST.md) and [known limitations](docs/KNOWN_LIMITATIONS.md).

## Architecture and assessment rules

Django Ninja routes call injected services composed in api/dependencies.py. Each *_repo.py contains an ABC contract only; *_service.py inherits it, and service models.py contains Pydantic models. Django ORM queries live in persistence/stores. Core and corridor Celery jobs are separate, with leased/fenced, atomic publication and retained completed snapshots. React displays authoritative backend risk/ranking; it does not reimplement business decisions.

Routes use complete geometry with great-circle sampling scaled to provider distance; ETAs interpolate valid maneuver timing or use a labeled proportional fallback. Weather accumulations use their preceding-hour interval and wind uses conservative bracketing at ETA. Exact continuous thresholds, strict cargo overrides and worst-endpoint interval mileage feed Severe/High/average/time ranking. Unknown/stale/No Travel alternatives cannot establish eligibility. Corridor frames use disjoint, conservatively clipped nearest-sample cells rather than additive heat intensity.

Read [architecture](docs/ARCHITECTURE.md), [risk rules](docs/RISK_RULES.md), [API contract](docs/API_CONTRACT.md), [decisions](docs/DECISIONS.md), [source attribution](docs/ATTRIBUTION.md) and the [eight-minute walkthrough](docs/WALKTHROUGH.md). Browser dependency notices ship at /THIRD_PARTY_NOTICES.txt. This is planning while stopped, not certified navigation/dispatch. Sampling, forecasts and arrival times have limitations; targeted accessibility checks do not certify WCAG compliance.
