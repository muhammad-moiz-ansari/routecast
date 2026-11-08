# Progress

Current phase: **Phase 1 complete — trip persistence, location search and route options.**
Completed implementation phases: 0 and 1. Next phase: 2, only upon the user's explicit request.

## Current implementation

Django/Ninja foundation and idle Celery remain in place. Phase 1 adds LocationRepo/Service, RoutingRepo/Service, TripRepo/Service with Pydantic models, explicit composition, TomTom HTTP adapters, anonymous owner sessions with CSRF, Trip/RouteSnapshot ORM entities and migration, owner-scoped stores and stored snapshot reads. Provider calls are synchronous for this phase; no background jobs were invented.

Trips validate coordinates, aware future departure, IANA display timezone, finite nonnegative cargo and 10/25/50 spacing. Routing requests truck mode, departure, primary plus two alternatives; preserves full GeoJSON geometry and stable A/B/C snapshot IDs; removes duplicate/resampled geometry. Zero/one/two options are reported honestly. Cargo is not gross vehicle weight. Stored reads never call providers. Failed operations retain sanitized failure state.

## API changes

GET /api/v1/session/, GET /api/v1/locations/search/, POST /api/v1/trips/ (201 synchronous), GET /api/v1/trips/{id}/, GET /api/v1/trips/{id}/routes/. All trip reads enforce session ownership; POST requires CSRF. See API_CONTRACT.md for fields, errors, statuses and bootstrap flow.

## Verification

See P1-OFFLINE through P1-LINT in VERIFICATION_LOG.md: all 26 new offline cases pass across targeted runs, relevant foundation checks pass, migration consistency/configuration/lint pass, domain migration applied to local PostgreSQL. Successful unaffected Phase 0 checks reused. External provider calls: 0. Public provider documentation consulted only.

Phase 0 local setup: user reported Docker/Compose/migrations/server working; Phase 1 independently confirmed PostgreSQL through migration application. No fresh Redis readiness request was needed. Earlier Docker-unavailable entry remains historical with the follow-up recorded in the ledger.

## Limitations / pending live evidence

Live TomTom search/routing and region/vehicle coverage remain unverified; no live tests were necessary for offline implementation. Credentials are optional for tests; missing keys fail clearly at runtime, without a fixture fallback. API errors expose no provider URLs/keys. Numeric Retry-After is supported; date-form parsing is deferred.

No idempotency-key handling yet: clients must prevent duplicate submissions and automatic POST retries. Per-process HTTP concurrency/timeouts are implemented; shared quota accounting, caching/coalescing/throttling and controlled retry policy remain future work. Keep current endpoints local pending later production controls. Clearing the anonymous session loses access; recovery/accounts are outside scope.

No checkpoint calculation, weather, recommendation, queued planning, refresh, frontend, publishing or deployment was added. No Git mutation was performed. Stopped after Phase 1; wait for the user's Phase 2 request.
