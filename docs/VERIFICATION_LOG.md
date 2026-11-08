# Verification ledger

Read this ledger before checks. Reuse successful evidence unless relevant code/configuration, dependencies, contracts or a prior failure changes. A new session, Git commit or API key does not invalidate evidence. No earlier implementation or verification records existed at phase start.

All results below are dated **2026-11-08**. Every check made **0 external application/provider requests, 0 provider locations, and 0 estimated provider usage units**. Dependency setup used PyPI metadata and package downloads only; no routing/weather APIs were accessed.

## Fingerprints

Foundation fingerprint: `4a30d67d820c360f36cb9224a9223db12cffa1d25442604bfe1bbbab3df7504a`.

SHA-256 input: sorted repository-relative paths plus LF, file bytes plus LF, for all backend Python files excluding .venv/__pycache__, backend/pyproject.toml, backend/uv.lock, compose.yaml, and both .env.example files. This captures code, tests and configuration independent of Git SHA. Documentation-only edits do not invalidate runtime checks.

Lockfile SHA-256: `caf9067dfdd44bf27e19361f73740fddb0dd9f3c95f324a1950be4e9c496f65a`.

## Results

| Check ID | Behavior | Mode | Result | Evidence | Retest trigger |
| --- | --- | --- | --- | --- | --- |
| P0-DEPS | Bounded stable dependencies and reproducible lockfile | Package setup | PASS | Python 3.12.12; uv 0.10.5; 44 packages resolved, 43 installed; uv sync --locked succeeded. Final minimum Ninja bound updated to 1.7 offline without version changes. | Requirements, lockfile or Python version changes |
| P0-CONFIG | Django configuration | Offline | PASS | manage.py check: no issues. Repeated after adding the template backend required by Ninja docs. | Django settings/apps/URL changes |
| P0-TESTS | Foundation behavior, migrations, schemas, units/time, imports and idle Celery | Offline; all sockets disabled | PASS | First pytest run: 21 passed, 1 failed (docs template backend missing). After fixing settings and updating readiness to Ninja Status: affected subset 5 passed, 17 deselected. Together all 22 unique cases passed; unrelated successful cases were reused. | Changes to the corresponding service, helper, adapter, schema, settings or dependencies |
| P0-MIGRATIONS | Django built-in migration setup and database probe | Offline SQLite | PASS | pytest-django created/migrated the test database; the real store executed SELECT 1; failure path also verified. No domain models or domain migrations exist yet. | ORM/app registration, database configuration or Django version changes |
| P0-HEALTH | Health endpoint has no database/cache calls; docs and OpenAPI are available | Offline client | PASS | Health 200 with dependency probes configured to fail if called. Docs HTML 200; schema contains only health/ready paths. | Health route, docs or API configuration changes |
| P0-READY | Ready/unavailable responses and bounded adapter behavior | Offline fakes + SQLite | PASS | All four database/cache combinations verified (200 or 503); Redis PING success/failure and timeout arguments verified; DB success/failure verified. No real Redis or PostgreSQL contacted. | Readiness routes, service or probe changes |
| P0-IMPORT | WSGI/ASGI/API imports and Celery configuration | Offline; sockets disabled | PASS | Imports succeeded with sockets disabled; empty Beat schedule; no application tasks registered. | Import wiring, settings, composition or Celery changes |
| P0-LINT | Python imports/style | Offline | PASS | Initial lint found two long test lines; formatter fixed them. Full ruff check passed. After the docs/readiness fix, changed files passed targeted lint; other evidence reused. | Python source changes; check affected files only |
| P0-START | Real local HTTP application startup | Local HTTP/manual smoke | PASS | Default local WSGI application served GET /api/v1/health/ with 200 and expected JSON. Non-loopback connects were blocked by the smoke script; server shut down afterward. | Server entry point, URL routing, settings or dependencies change |
| P0-INFRA | Compose validation/startup, PostgreSQL migrations and real Redis readiness | Local infrastructure | PENDING | Docker executable/standard installation, psql and redis-server unavailable here. Container startup and real PostgreSQL/Redis checks were not run. Follow README when Docker is installed. | Docker/local PostgreSQL and Redis become available; run this missing check only |
| FUTURE-PROVIDERS | TomTom/Open-Meteo live contracts | Live | PENDING / deferred | Future integration phases only; no provider implementations or credentials in Phase 0. | Explicitly requested relevant integration phase and a bounded justified live check |

## Execution notes

- Initial uv interpreter-cache permission trouble was avoided with an ignored workspace UV_CACHE_DIR. Sandbox DNS blocked initial PyPI resolution; approved package-registry access resolved it. Downloads were slow, with transient Windows rename warnings, but installation completed successfully. Do not repeat the successful sync merely due to these earlier warnings.
- Initial docs failure was corrected by configuring DjangoTemplates. Ninja's deprecated tuple response was replaced with Status; only affected tests were repeated.
- Initial local HTTP smoke was denied by sandbox socket policy (WinError 10013). The identical loopback-only smoke passed with approved local network access. This was an environment restriction, not an application failure.
- Docs HTML/schema were verified locally. Swagger browser/CDN rendering and visual accessibility are not claimed; no browser asset requests were made.
- No provider calls, active jobs, Beat scheduler, frontend implementation, deployment, or Git mutation occurred.


## Phase 1 — 2026-11-08

Code/fixture fingerprint: `fcc74cf38675d7edf4897f93daecf3a245002811a133004e9a3ed040057bfc35`. SHA-256 of sorted backend Python paths/file bytes and tests/fixtures JSON (path + LF + bytes + LF); excludes .venv and __pycache__. Existing lockfile/dependencies unchanged. Actual outbound **provider requests 0**, locations 0, estimated provider usage units 0. Official public TomTom documentation was read; no provider endpoints were exercised.

| Check ID | Behavior | Mode/result | Evidence | Retest trigger |
| --- | --- | --- | --- | --- |
| P1-OFFLINE | Trip/route/place contracts, provider failures, validation, ownership, CSRF, persisted reads | Offline/PASS | 26 unique new Phase 1 test cases pass across initial and affected reruns. Initial combined run: 28 passed, 1 failed, 18 deselected (25 Phase 1 + 4 relevant foundation cases). Session bootstrap needed HttpResponse annotation; its single-case retest passed. After response contracts and overflow protection, affected/new subset passed 7 cases, 19 deselected. All tests use pytest-socket's socket block and synthetic HTTPX MockTransport fixtures. | Corresponding service, API, schema, store or adapter changes |
| P1-CONFIG | Django and migration consistency | Offline/PASS | manage.py check: no issues; makemigrations --check --dry-run with test settings: no changes. | App/model/settings changes |
| P1-MIGRATION | New domain migration on PostgreSQL | Local/PASS | persistence.0001_initial applied OK to configured local PostgreSQL; no existing data removed. Initial sandbox attempt denied loopback (10013), approved local execution succeeded. SQLite tests also apply the migration. | ORM/migration/backend changes; no need to reapply an already applied migration |
| P1-DOCS | Expanded OpenAPI, docs and liveness | Offline/PASS | Existing foundation docs test updated for added routes; passed initially and after final response-schema additions. | API registration/contracts/docs configuration changes |
| P1-IMPORT | Imports/idle Celery remain free of network I/O | Offline/PASS | Relevant existing import test passed in affected foundation subset with sockets disabled. | Composition/import/Celery changes |
| P1-LINT | Source style/imports | Offline/PASS | Ruff format/check corrected initial generated formatting/import issues; final full check passed. | Source changes; target affected files |
| P1-LIVE | Real TomTom search/routing contract and region coverage | Live/PENDING | Intentionally not invoked; no credentials inspected and no live budget spent. Offline implementation evidence is not a live verification claim. | Necessary bounded adapter check requested/justified; announce request/location ceilings first |

Reused P0 dependency resolution, unit/time helpers, Redis adapter and readiness evidence without repeating those successful checks. The new model/schema and URL changes justified migration/configuration/import/docs regression checks. No broad repeated Phase 0 suite.

P0-INFRA follow-up: the user installed Docker, successfully ran Compose/migrations/server instructions, and reported “good it worked.” This is user-reported manual evidence, not a captured readiness response. The Phase 1 PostgreSQL migration above is independently observed. Real Redis readiness was not repeated; the earlier P0-INFRA environment limitation is historical, not a claim Docker is still absent.
