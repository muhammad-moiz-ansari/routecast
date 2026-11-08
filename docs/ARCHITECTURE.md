# Architecture

The foundation implements Django configuration, Django Ninja API registration, health operations and shared helpers. API routes call services through `api/dependencies.py`. HealthService inherits HealthRepo and receives explicit probe callables; construction performs no network I/O.

For each implemented service use `<name>_repo.py` (ABC signatures only), `<name>_service.py` (concrete subclass), and `models.py` (Pydantic contracts). Public methods and interface methods have concise docstrings. Comment decisions rather than restating assignments. Health is the first real service; future services are not empty scaffolds.

ORM operations belong in `persistence/stores/`; only `persistence` is a Django model application. `persistence/models.py` now defines Trip and RouteSnapshot, separate from service schemas. The initial domain migration creates these tables alongside Django auth/session tables.

Dependency direction: routes â†’ service interfaces â†’ injected infrastructure/other interfaces. Integrations will own provider HTTP, stores own database access, cache adapters own Redis. Tasks will call services. No endpoint calls another endpoint internally. Celery has an explicit entry point, JSON serialization, UTC, and an empty Beat schedule. No import starts workers or contacts dependencies.

Production/local use PostgreSQL and Redis. Offline tests deliberately use SQLite and memory cache; readiness's real adapters are independently exercised using fakes. Readiness executes SELECT 1 and Redis PING only, exposes booleans, and uses bounded timeouts. Liveness requires neither dependency. Anonymous ownership and TomTom adapters are implemented in Phase 1. Distributed throttling, risk calculations and UI remain later work.

Shared helpers reject nonfinite/negative quantities and naive times, normalize instants to UTC, and preserve IANA display timezones. Unknown is a data quality category, not a zero risk score. Units remain explicit; converting precipitation depth does not establish an hourly rate. GeoJSON uses [longitude, latitude].

Frontend implementation is deferred to Phase 7; use the companion design specification then. Do not install frontend dependencies early.

## Phase 1 data flow

Session bootstrap stores an opaque owner UUID in the server-side Django session. Cookie authentication performs CSRF validation on writes. Routes obtain composed services from api/dependencies.py; service repo modules remain ABC signatures only. TripService uses TripStore and RoutingRepo; RoutingService normalizes the injected TomTom routing client. LocationService wraps the injected geocoding client. HTTPX construction and all provider I/O occur only during explicit service operations.

Trip creation persists validated inputs, makes one synchronous routing request, then atomically stores a normalized route snapshot and marks routes_ready. A provider failure preserves routing_failed and its sanitized code. No database transaction spans provider I/O. Snapshot reads are owner-scoped and never contact TomTom. Full asynchronous PlanningService/job orchestration belongs to Phase 5; it is not scaffolded here. No weather, checkpoints or authoritative risk calculations are added.

## Phase 2 checkpoints and ETA

CheckpointRepo is an ABC contract; CheckpointService implements its pure `generate(CheckpointRequest)` operation using typed Pydantic inputs/outputs. API routes first read the owner-scoped trip using TripRepo, then pass its selected route, departure, spacing and analysis version to the explicitly composed checkpoint service. They do not call another endpoint. No ORM/infrastructure access appears in the checkpoint contract or calculator. No migration is needed: the existing route snapshot JSON carries optional normalized timing, and old JSON remains readable.

The routing adapter requests coded maneuver instructions in its existing single routing request. RoutingService normalizes provider routeOffsetInMeters/travelTimeInSeconds into typed RouteTimingPoint values. This separates provider transport from checkpoint calculations. Invalid or absent timing yields an explicit proportional fallback, without another request. The checkpoint projection performs only deterministic calculations over a stored snapshot; no network or database writes occur during generation.

Distance targets use provider road chainage. Full-polyline spherical length is measured segment by segment and normalized to that chainage, preserving both endpoints and route totals. Great-circle interpolation avoids planar degree calculations and dateline mistakes. Duplicate zero-length vertices are ignored only during sampling; stored analysis geometry remains untouched. ETA interpolation uses the applicable valid provider span; endpoints are anchored to departure and total duration. See API_CONTRACT.md for approximation/limit metadata and errors.
