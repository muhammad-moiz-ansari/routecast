# Release and operation runbook

Prepared 9 November 2026. Configuration is ready for a controlled, noncommercial assessment deployment after user authorization. Nothing was deployed. Image builds, Linux process execution, hosted HTTPS/CSRF and real broker/provider E2E remain pending. Docker is unavailable in the implementation environment, so YAML inspection is not a Compose/image/runtime smoke.

## Topology and trust boundary

Use the standalone compose.production.yaml, never merge it with development compose.yaml. One TLS ingress/access gate on the host forwards to loopback 127.0.0.1:8080, preserving the original public Host. Nginx serves built Vite assets and routes /api/ to private Gunicorn. PostgreSQL/Redis have no host ports and an internal data network; workers have a separate outbound network for providers. Keep the gateway private to the host/ingress, and never publish API port 8000. Django trusts X-Forwarded-Proto only because this Nginx overwrites it with https at that private boundary. Do not expose this proxy directly as public cleartext HTTP.

This package does not provision TLS, DNS, a load balancer, ingress authentication or hosting. Put a controlled assessment behind your organization's existing authenticated HTTPS ingress before opening it to other viewers. Anonymous owner sessions protect trip ownership; they are not a public abuse-control/account system. Secure __Host- session/CSRF cookies require the actual HTTPS origin; direct http://localhost:8080 is not a valid session smoke. No CORS exception or cross-origin API host is needed.

Frontend static files are built in frontend/Dockerfile; /trips/{id} falls back to index.html, while missing /assets files return 404. Hashed assets cache for a year; HTML revalidates. API responses are not gateway-cached. The image carries THIRD_PARTY_NOTICES.txt. No Django admin or user uploads/staticfiles application exists, so collectstatic/WhiteNoise is not required for this layout. Production docs/OpenAPI endpoints are disabled; local docs remain available.

## Prepare a release (no service startup)

From the repository root, copy .env.production.example only if .env.production does not already exist. Edit the ignored file privately. Set a unique random >=50-character DJANGO_SECRET_KEY, explicit host names without scheme/wildcard, a unique database password and your server-only TomTom key. Do not reuse local development secrets. Restrict file access; on Linux use chmod 600 .env.production. Never include this file in images, source archives or console output. Container source COPY is allowlisted and both build contexts ignore real .env files.

Keep ROUTECAST_LIVE_TEST_MODE=true initially: it disables periodic scheduling but explicitly queued analyses still use providers. Add only public, origin-restricted map style URLs for both day/night if licensed basemap context is needed; these are compiled into browser assets. Keep routing/weather credentials out of VITE variables. Changing a frontend build variable requires a rebuild, not just a container restart.

Set a unique RELEASE_TAG for each release. For a chosen release record approved immutable digests in PYTHON_IMAGE, NODE_IMAGE, NGINX_IMAGE, POSTGRES_IMAGE and REDIS_IMAGE. Defaults bound language/database families for preparation; mutable image tags are not an immutable release inventory. uv's builder tool is pinned to 0.10.5; backend dependencies and Gunicorn 26.2.0 resolve in uv.lock; npm uses package-lock.json. Revalidate image security/support and hosting resources at release time. No entirely free always-on hosting is promised.

The following commands are for the user to run only after release authorization. `config --quiet` validates without dumping resolved secrets. Build does not start workers:

```powershell
docker compose --env-file .env.production -f compose.production.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml build api gateway
```

The backend image uses Python 3.12, uv sync --locked --no-dev, nonroot UID 10001, read-only application filesystem and Gunicorn gthread workers. Nginx is also nonroot/read-only and writes temporary files only under /tmp. No build command migrates a database, starts a scheduler or calls providers. Do not start a new live-provider verification merely because a build succeeds.

## Release, schema and process order (requires user authorization)

1. Record the image IDs/digests, lockfile hashes and current ledger evidence. Prepare TLS/Host routing/access gate and provider terms/account spending controls.
2. For an existing installation, disable ingress writes and stop Beat, then gracefully stop both worker queues and API before the database backup/migration. Worker grace is 16 minutes for the configured 840/900-second task limits. Retained queued work may execute when workers restart; inspect operational state before enabling them.
3. Back up PostgreSQL and verify restore procedure in a disposable environment. Example command in the PostgreSQL container: `pg_dump -U routecast -d routecast -Fc -f /tmp/routecast-pre-release.dump`, then copy the dump outside the container and protect it. Adjust database/user from your environment without exposing passwords. Record backup location; a dump alone is not a tested restore. Redis holds leases, broker messages and cached forecasts; do not clear it during a rolling release or treat it as disposable while jobs are active.
4. Start only data dependencies, then run schema/checks using the exact backend image. On a first installation there is no preexisting database to back up:

```powershell
docker compose --env-file .env.production -f compose.production.yaml up -d --wait postgres redis
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps api python manage.py migrate --plan
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps api python manage.py migrate --noinput
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps api python manage.py check --deploy
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps api gunicorn --check-config --config config/gunicorn.py config.wsgi:application
```

5. Start API and gateway (gateway waits for the internal dependency-readiness healthcheck), verify the public HTTPS origin's /api/v1/health/ and /api/v1/ready/, SPA deep link/assets and session-cookie/CSRF behavior. Readiness probes only PostgreSQL/Redis, not providers. Check one allowed Host and rejected unexpected Host. Confirm internal ports cannot be reached externally. Intentional Django deploy-check warnings concern HSTS subdomains/preload: only the current host gets a one-hour policy until domain/TLS ownership is verified; do not enable global/preload policy blindly.
6. Separately start core worker (`-Q celery`, concurrency 2), corridor worker (`-Q corridor`, concurrency 1), and exactly one Beat. Compose defines their commands. Linux prefork enables task time limits; Windows solo remains development-only. Starting workers can consume provider quota on queued jobs. Do not scale Beat above one. Keep the same release image for API/workers/Beat.
7. Enable periodic scheduling (`ROUTECAST_LIVE_TEST_MODE=false`) only when runtime provider work is intended and limits/terms are confirmed; recreate API, both workers and Beat with the same environment. Reopen controlled ingress after missing runtime evidence is recorded. RouteCast does not provide an automatic rollback/deployment controller.

Do not use `down -v`, flush Redis, run automatic migration reversal or delete volumes as a release step. On failure close ingress, stop Beat/workers, retain logs/state and return to the prior images only if schema compatibility has been checked. Restore into a new database and validate before switching connections when data recovery is necessary. Keep PostgreSQL, Redis and Beat state volumes separate; configure off-host backups and operational retention for the actual host.

## Limits and observability

Nginx imposes an aggregate 2 requests/second with burst 20 on /api/, returns 429 on excess and limits bodies to 32 KB. This is admission protection, not per-owner or daily provider enforcement. Separate PostgreSQL-backed hard budgets now reserve TomTom requests and weighted weather units across all processes before HTTP; apply migration 0004 and use identical limits everywhere. See API_USAGE_LIMITS.md. Redis telemetry remains acquisition-attempt accounting; per-owner quotas are still absent. Process concurrency caps are not global account limits. Use controlled access and provider account restrictions/monitoring; unrestricted public release requires further abuse/quota work.

Defaults: 15-second visible status polling, 60-second viewer heartbeat, 15-minute reassessment/forecast reuse, 30-minute viewer expiry, 60-second manual cooldown, 900-second renewable lease, <=3 transient analysis attempts, <=5 durable broker deliveries, corridor <=100 locations in batches <=50. Core checkpoint forecasts remain separately sampled and may exceed corridor budgets on long trips. See [API usage limits](API_USAGE_LIMITS.md) for provider controls and [known limitations](KNOWN_LIMITATIONS.md) for remaining runtime checks.

Log only necessary operational data. Gateway/Gunicorn access formats omit query strings and headers; HTTPX/httpcore are capped at WARNING. Never publish dumps, resolved Compose output or environment variables. Monitor readiness, failed jobs/error codes, queue backlog, worker liveness, viewer freshness, database/Redis capacity and provider counters. Private health endpoints/monitoring commands do not replace a real broker or provider contract smoke.

## References and pending evidence

[Django deployment checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/), [Gunicorn configuration](https://gunicorn.org/configure/), [Nginx proxy headers](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header). Current missing checks are listed in [known limitations](KNOWN_LIMITATIONS.md). These instructions prepare a release; they are not evidence that images, TLS ingress or hosting were executed.
