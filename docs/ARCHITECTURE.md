# Architecture

The foundation implements Django configuration, Django Ninja API registration, health operations and shared helpers. API routes call services through `api/dependencies.py`. HealthService inherits HealthRepo and receives explicit probe callables; construction performs no network I/O.

For each implemented service use `<name>_repo.py` (ABC signatures only), `<name>_service.py` (concrete subclass), and `models.py` (Pydantic contracts). Public methods and interface methods have concise docstrings. Comment decisions rather than restating assignments. Health is the first real service; future services are not empty scaffolds.

ORM operations belong in `persistence/stores/`; only `persistence` is a Django model application. `persistence/models.py` now defines Trip and RouteSnapshot, separate from service schemas. The initial domain migration creates these tables alongside Django auth/session tables.

Dependency direction: routes â†’ service interfaces â†’ injected infrastructure/other interfaces. Integrations will own provider HTTP, stores own database access, cache adapters own Redis. Tasks will call services. No endpoint calls another endpoint internally. Celery has an explicit entry point, JSON serialization, UTC, and an empty Beat schedule. No import starts workers or contacts dependencies.

Production/local use PostgreSQL and Redis. Offline tests deliberately use SQLite and memory cache; readiness's real adapters are independently exercised using fakes. Readiness executes SELECT 1 and Redis PING only, exposes booleans, and uses bounded timeouts. Liveness requires neither dependency. Anonymous ownership and TomTom adapters are implemented in Phase 1. Distributed throttling, risk calculations and UI remain later work.

Shared helpers reject nonfinite/negative quantities and naive times, normalize instants to UTC, and preserve IANA display timezones. Unknown is a data quality category, not a zero risk score. Units remain explicit; converting precipitation depth does not establish an hourly rate. Future GeoJSON uses [longitude, latitude].

Frontend implementation is deferred to Phase 7; use the companion design specification then. Do not install frontend dependencies early.

## Phase 1 data flow

Session bootstrap stores an opaque owner UUID in the server-side Django session. Cookie authentication performs CSRF validation on writes. Routes obtain composed services from api/dependencies.py; service repo modules remain ABC signatures only. TripService uses TripStore and RoutingRepo; RoutingService normalizes the injected TomTom routing client. LocationService wraps the injected geocoding client. HTTPX construction and all provider I/O occur only during explicit service operations.

Trip creation persists validated inputs, makes one synchronous routing request, then atomically stores a normalized route snapshot and marks routes_ready. A provider failure preserves routing_failed and its sanitized code. No database transaction spans provider I/O. Snapshot reads are owner-scoped and never contact TomTom. Full asynchronous PlanningService/job orchestration belongs to Phase 5; it is not scaffolded here. No weather, checkpoints or authoritative risk calculations are added.
