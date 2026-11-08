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


## Phase 2 — 2026-11-08

Code/fixture fingerprint: `074fb7d283a56b65a77b928e6a7e5eb879ba25e5263b557c1757a8f81f36460a`. SHA-256 input follows the Phase 1 convention: sorted backend Python and test-fixture JSON paths + LF + file bytes + LF, excluding .venv/__pycache__. Dependencies, lockfile, ORM models/migrations and environment files unchanged. External provider requests **0**, provider locations **0**, estimated usage units **0**. Official public TomTom guidance documentation was consulted; no provider API endpoint was called.

| Check ID | Behavior | Mode/result | Evidence | Retest trigger |
| --- | --- | --- | --- | --- |
| P2-CHECKPOINTS | Spacing, full-polyline interpolation, endpoint inclusion, intervals, ETA, schemas | Offline/PASS | 35 new Phase 2 cases passed. Covers 10/25/50 mi, very short routes, exact multiples, partial intervals, strictly increasing distance/nondecreasing ETA, destination duration, bent/duplicate-vertex geometry, route-specific IDs/positions, dateline interpolation, measured spacing, provider timing spans, malformed/decreasing/conflicting/out-of-bounds/absent timing, legacy snapshot fallback, degenerate/antipodal/oversized routes, interface/schema validation and API/OpenAPI behavior. | Checkpoint geometry/timing/contracts/calculator changes |
| P2-API | Owner-scoped deterministic checkpoint projection and no provider I/O | Offline/PASS | New projection test verifies same-session reads, repeated identical responses, foreign/missing trip 404, unknown route 404, missing route_id 422, no session 401, no snapshot 409, and legacy JSON snapshots. ProviderHTTP.get raises if called during reads; pytest sockets disabled. | Checkpoint route/session/store/composition changes |
| P2-ROUTING | Optional maneuver timing in the same request and route regressions | Offline/PASS | New MockTransport test verifies instructionsType=coded, one request and normalized timing. Seven existing relevant Phase 1 cases passed: routing request/normalization, zero/one/two alternatives, resampled geometry, owner/CSRF/stored reads, failed snapshot behavior. | Provider transport/request/normalization/route schema changes |
| P2-FOUNDATION | API docs/imports and idle Celery regression | Offline/PASS | Two existing foundation cases passed for docs/liveness and application imports with sockets blocked. New OpenAPI projection contract case passed. | API registration/import/composition changes |
| P2-CONFIG | Django configuration | Offline/PASS | manage.py check: no issues. | Django/API/settings changes |
| P2-LINT | Changed/new Python source style | Offline/PASS | Ruff formatting/import cleanup followed by passing targeted lint on changed packages/helpers/new tests. | Relevant source changes |
| P2-LIVE | Actual provider maneuver timing availability/contract | Live/PENDING | Not necessary for offline acceptance; no live request budget spent. Phase 1 live provider evidence remains pending. Existing snapshots are never re-fetched by checkpoint reads. | A necessary bounded adapter check is explicitly justified and announced |

One combined targeted test execution: **44 passed, 39 deselected** (35 new Phase 2 cases + 9 affected existing cases). No failed tests and no unnecessary successful test reruns. Targeted command: `pytest -q tests/test_phase2.py tests/test_phase1.py tests/test_foundation.py -k 'phase2 or routing_contract_and_normalization or fewer_routes or resampled_duplicate_geometry or owner_csrf_and_persisted_reads or failed_trip_retained or imports_and_idle_celery or liveness_and_documentation'`. All test sockets blocked by existing pytest configuration.

Reused Phase 0 units/time, health/readiness/Redis and dependency evidence, and unaffected Phase 1 location, validation, provider-error/timeout and PostgreSQL migration evidence. No ORM or dependency changes justified repeating migrations, Docker startup, package installation or infrastructure checks. No live requests, background jobs, frontend, Git mutations, publishing or deployment.


## Phase 3 — 2026-11-08

Code/fixture fingerprint `189f76c49aaffb4e49968ab9fc4386fbb30cbfa3d3553ed2db7245f17b62ca4c`: SHA-256 over sorted backend Python/JSON paths + LF + bytes + LF excluding .venv/__pycache__. ORM/migrations/dependencies/lockfile/environment unchanged. Actual external provider requests **0**, locations **0**, estimated usage units **0**. Public Open-Meteo documentation consulted only.

| ID | Behavior | Mode/result | Evidence | Retest trigger |
| --- | --- | --- | --- | --- |
| P3-OFFLINE | Unit normalization, nulls, matching, horizon, cache reuse/staleness | Offline/PASS | Initial targeted run: 18 passed, 20 deselected (16 new Phase 3 cases + 2 affected foundation cases). Covers rain+showers, cm snow depth, missing variables, malformed units/arrays/NaN/time axis, exact-hour boundaries/bracketing wind, outside horizon, exact coordinate deduplication, changed ETAs reusing cache, stale GETs, missing cache and error handling without retries. | Corresponding weather/client/cache/matching changes |
| P3-BATCH | Batch boundary and shared usage counts; timeout and alternate units | Offline/PASS | Two additional new cases passed, 16 existing Phase 3 cases deselected: 51 locations produce two HTTP mock requests, counts 2/51 recorded in shared cache; timeout sanitized and inch/mph units handled. | Batching/accounting/provider adapter changes |
| P3-API | Owner enforcement, CSRF and cache-only reads | Offline/PASS | Included in initial run: owner GET with empty cache makes no request, POST without CSRF rejected, valid prefetch returns data, repeated GET issues no requests, foreign session denied. | API/session/composition changes |
| P3-CONFIG | Configuration and source lint | Offline/PASS | Django check reports no issues; changed/new source passes Ruff after formatting/import cleanup. No test failures. | API/config/source changes |
| P3-FOUNDATION | Imports, idle Celery and docs registration | Offline/PASS | Two relevant foundation cases passed in initial targeted run with sockets blocked. | Composition/API import changes |
| P3-LIVE | Real Open-Meteo contract/coverage | Live/PENDING | No live test needed for offline implementation; no API budget spent. If necessary later, state reason and max one request/five locations/no retries first. | Justified missing live adapter evidence |

Totals: 18 new Phase 3 cases plus 2 affected existing cases passed across two targeted executions. Existing pytest socket blocking remained enabled; HTTPX MockTransport fixtures supplied synthetic provider arrays. Successful unrelated Phase 0–2 tests and PostgreSQL migration evidence were reused. No migrations, infrastructure restarts, package installation or prior provider checks repeated. No Git mutation, frontend, publishing or deployment.

Known limits: provider-backed runtime/cache freshness is implemented but live provider validation remains pending. Fixed public endpoint, per-process concurrency and daily shared usage counters do not implement distributed coalescing or enforce provider quotas. Retained stale cache survives failed prefetch and is available via GET; no background retry/job is started.


## Phase 4 — 2026-11-08

Code/fixture fingerprint `3d2d3ce2b3d15297ad035076a8468ada2a9d0d6fdfffff39b49a8ed8f2b34d2a`: SHA-256 of sorted backend Python/JSON path + LF + bytes + LF, excluding .venv and __pycache__. Rules version 2026-11-08.v1. Dependencies, lockfile, environment, provider adapters and ORM/migrations unchanged. External provider requests **0**, locations **0**, estimated usage units **0**.

| Check ID | Behavior | Mode/result | Evidence | Retest trigger |
| --- | --- | --- | --- | --- |
| P4-RULES | Weather/load boundaries and combination | Offline/PASS | Each of 12 weather boundaries checked immediately below/at/above with nextafter; strict 30k/40k cargo limits, exact rain=1/snow=3, wind >=55, known hazards with missing values, Unknown, stale coverage and invalid NaN tested. | Rule constants/classification/input changes |
| P4-MILEAGE | Conservative endpoint assignment, partial intervals, weighted average | Offline/PASS | Actual 63-mile route intervals 25/25/13 yield Moderate 25 and High 38 miles; average (25+38×2)/63; total reconciles. Unknown/incomplete routes have null average and explicit unassessed miles. | Interval aggregation or checkpoint contract changes |
| P4-RANK | Eligibility, lexicographic order and explanations | Offline/PASS | Slower route wins on Severe miles; remaining High/average/time priorities; stable ID tie-break; sub-display-precision values not rounded. All blocked/empty/stale/incomplete cases and eligible-plus-unassessed notice covered. | Eligibility, ranking or explanation changes |
| P4-API | Owner enforcement, provider-free projection and unchanged snapshots | Offline/PASS | Missing/foreign sessions rejected; missing cached weather returns INCOMPLETE_DATA; repeated reads deterministic; provider methods fail if invoked. Complete cached-data case recommends A and confirms snapshot/status unchanged. Pending/failed routing, analysis mismatch rejection and wrong-ETA weather exclusion also tested. | API/service/composition/cache contracts change |
| P4-FOUNDATION | Import/docs/configuration regression | Offline/PASS | Two existing relevant foundation tests pass with sockets blocked; expanded OpenAPI present; Django check has no issues. | API imports/registration/settings change |
| P4-LINT | New/changed source style | Offline/PASS | Formatting/import cleanup and targeted Ruff check pass; initial long string fixed. | Source changes |

Execution: initial targeted run **37 passed, 20 deselected** (35 new Phase 4 cases + 2 affected foundation cases). Two additional tests ran: pending/version case passed; complete-cache integration initially failed due to missing imports in the test itself. Imports corrected, only that failed test rerun, **1 passed**. All **37 unique new cases + 2 foundation cases** now pass. No previously successful cases repeated. Existing pytest-socket blocks external requests throughout; synthetic/mock data only.

Reused unaffected Phase 0–3 verification for units/time, routing/geometry, forecasting/unit normalization/matching, usage accounting, migrations, Redis and provider adapters. No live provider, infrastructure or dependency setup checks repeated. Existing live provider evidence remains pending; this pure rules/ranking phase requires no new live evidence. No migration, frontend, background job, Git mutation, publishing or deployment.


## Phase 5 — 2026-11-08

Code/fixture fingerprint `c4ddba457cac50ff1f36cdf6ee66e08107a367864d9df1cbf09172327daebd4e`: sorted backend Python/JSON path + LF + bytes + LF, SHA-256, excludes .venv/__pycache__. Dependencies/lockfile and real environment files unchanged. Migration 0002 added lifecycle fields and AnalysisRun; optional .env.example defaults added. External provider requests **0**, locations **0**, estimated usage units **0**. Local PostgreSQL/Redis traffic and HTTPX fixture requests are not external provider calls.

| Check ID | Behavior | Mode/result | Evidence | Retest trigger |
| --- | --- | --- | --- | --- |
| P5-LIFECYCLE | Queue, duplicate protection, publication, fencing, retries, viewer activity and stop | Offline/PASS | 16 new fake-clock lifecycle cases pass across targeted runs. Covers queue-before-provider work, duplicate execution/coalescing, manual cooldown, failed refresh retention, old-revision rejection, stop during routing, inactivity/heartbeat revival, bounded transient attempts reusing candidate routes, expired token/unique-active constraint, bounded broker recovery, stages and guarded weather batches, rollback on publication failure, live-test scheduling disable, and no periodic credential retries. | Planning/refresh/store/lease/config changes |
| P5-API | 202 creation, ownership/CSRF, PATCH, snapshots and ETags | Offline/PASS | Included lifecycle cases verify owner/foreign access, conditional 304, status ETag changes, repeated provider-free polling, frozen projection consistency, full input revision replacement, 429 cooldown shape, stop 409, stale recommendation withholding with previous ID retained, and no snapshot mutation. | API/session/composition/projection changes |
| P5-CONFIG | Configuration, migration consistency and lint | Offline/PASS | Django check passed; makemigrations --check --dry-run reports no changes; Ruff final full-source check passes after generated formatting/import cleanup. Configuration check repeated only after new logging/scheduler settings. | Models/settings/source changes |
| P5-MIGRATION | Local PostgreSQL domain lifecycle migration | Local/PASS | persistence.0002_trip_active_trip_input_revision_and_more applied OK. Historical viewer expiry and version seeding avoid unsolicited scheduling and version reuse. No existing trips/routes removed. | Migration/model/backend changes |
| P5-REDIS | Real token-owned Lua acquire/renew/release/expiry configuration | Local/PASS | Unique temporary key: competing acquire denied, foreign renew false, foreign release preserved ownership, owner renewal with positive TTL, owner release removed key. Key removed; non-loopback connects blocked. | Redis lock scripts/client changes |
| P5-POSTGRES | Real uniqueness and fenced transaction/JSON roundtrip | Local/offline-provider PASS | New synthetic trip/run exercised PlanningService with real PostgreSQL/Redis and mock provider; active candidate uniqueness enforced, complete recommendation published, JSON read back. All synthetic DB rows rolled back and locks released; no broker or provider calls. | Store/publication/constraint/serialization changes |
| P5-FOUNDATION | Imports/docs | Offline/PASS | Two relevant prior foundation tests passed in initial targeted lifecycle run with sockets blocked. | API/import/task registration changes |
| P5-WORKER | Real Celery broker/worker/Beat end-to-end dispatch | Local/PENDING | No workers/Beat launched, avoiding unannounced provider work. Services, dispatch recovery and worker entry points implemented; actual process lifecycle smoke remains pending. | Bounded offline-provider worker fixture setup or separately authorized runtime/live verification |

Execution evidence: initial selection **11 passed, 20 deselected** (9 new + 2 relevant foundation). Three added cases yielded 2 passes and one PATCH 405 failure. PATCH was on a separate router shadowed by GET; first edit attempt did not apply, so that failed case remained failing. Moving PATCH to the trip router fixed it; only the failed case rerun passed. Later new guard/transaction cases and relevant response/constructor changes received targeted checks; no broad repeat of pure provider/rules suites. Live-test mode and credential retry suppression each received one new passing case. All 16 unique new cases and 2 foundation cases pass; no unresolved failures. Cooldown response and changed DI/API tests were repeated only when their relevant code changed. After adding the post-fetch lease guard, its affected guard test alone was repeated and passed.

Eight earlier integration cases asserting synchronous 201 creation or current-cache projections were superseded and removed in favor of the new lifecycle tests. Pure routing/normalization/geometry/weather/rule tests remain, and their recorded evidence was reused. The shared routing fixture helper now exposes RoutingService directly rather than relying on the retired synchronous TripService constructor. This is a contract migration, not a claim those historical expectations still apply.

No provider contract checks, dependency installations, successful earlier migrations or existing readiness checks were repeated. Real broker/worker/Beat execution and live providers remain pending; implementation is verified via service-level fake dispatch/clocks, guarded offline fixtures and targeted local infrastructure smokes. No Git mutation, frontend, publishing or deployment.


## Phase 6 — 2026-11-08

Fingerprint `81ae33e24658bfb843bed22e4be0f67061434185d1864269bc01d6ad2ff62fb4`: SHA-256 over sorted backend Python/JSON paths + LF + bytes + LF, excluding .venv/__pycache__. Dependencies/lockfile/real environment unchanged; 0003 adds CorridorRun. External provider requests **0**, locations **0**, estimated usage units **0**. All forecast acquisition used synthetic test services.

| ID | Behavior | Mode/result | Evidence | Retest trigger |
| --- | --- | --- | --- | --- |
| P6-GRID | Geographic tube sampling/overlap/budget | Offline/PASS | Duplicate routes deduplicate; adaptive spacing and three long alternatives stay <=100 locations; dateline/high-latitude/repeated vertices valid; points on an equatorial route tube/endcaps stay within the requested 10-mile radius. | Geometry/cap/config changes |
| P6-DATA | Frames, masks, cache, ownership/versions | Offline/PASS | 49 frames, fixed UTC anchor, correct analysis version; missing/null/provider-error masks; unchanged cached arrays after clock advance; duplicate delivery does not refetch; owner/foreign session checks and private ETag 304. | Dataset/cache/API changes |
| P6-JOBS | Failure isolation/recovery/stop | Offline/PASS | Core payload unchanged after null/batch failures, stop and ancillary dispatch failure. Stopped jobs make no forecast call; missing ancillary entry recovered once without provider work during recovery. | Job/store/lifecycle hook changes |
| P6-CONFIG | Configuration/migration consistency/lint | Offline/PASS | Two relevant foundation docs/import cases passed; Django check passed, makemigrations --check --dry-run reports no changes; final Ruff check passes. | Models/settings/imports/source changes |
| P6-MIGRATION | PostgreSQL | Local/PASS | persistence.0003_corridorrun applied OK; existing core snapshots unchanged. | Schema/backend changes |
| P6-LIVE | Real worker/provider acquisition | Pending | No worker/Beat/live provider execution performed; earlier pending process/provider evidence remains pending. | Explicit justified bounded missing live/process check |

11 new Phase 6 cases and 2 affected existing foundation cases passed across targeted runs. Initial run: 6 passed, 20 deselected, 5 fixture setup errors (implicit fixture import removed by Ruff). Explicit fixture alias fixed setup; affected 5 passed. Recovery/config/read changes justified targeted recovery/stop/frame retests. New geographic containment test had a test-only conversion typo (16093.344 instead of 16093.44), corrected; only that failed case repeated and passed. No unresolved test failures.

Existing provider normalization/cache, usage accounting, core risk and Redis lock evidence reused; no dependency installation, old migration repetition, live API or broad pure regression suite. No Git mutation/frontend/publishing/deployment. Sparse curvilinear sampling/renderer clipping requirements documented; real broker/provider execution remains pending.
