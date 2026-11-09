# Architecture

## Shared provider budget guard (9 November 2026)

Both provider transports reserve allowance through integrations/provider_budget.py before opening outbound HTTP. ORM operations remain in persistence/stores/provider_budget_store.py, with a single ProviderBudget row per provider containing bounded UTC windows. A durable transaction and PostgreSQL select_for_update serialize minute/hour/day/month reservations and commit them before HTTP; nested outer transactions, storage errors, malformed counters and backwards windows fail closed. New migration 0004 creates only this ledger. TomTom search/routing share a request budget; core/corridor Open-Meteo calls share weighted location budgets derived from request horizon/variables. No Redis flush or credential rotation resets this ledger. Read-only management command provider_usage reports limits/usage/reset times without provider calls. Transport tests inject no-op guards only when isolating existing HTTP parsing; dedicated guard tests exercise actual SQLite reservations and mock HTTP. PostgreSQL concurrent-lock runtime evidence remains pending. See API_USAGE_LIMITS.md for activation, settings and scope.

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

## Phase 3 weather

WeatherRepo defines the abstract assess contract; WeatherService inherits it and receives an injected forecast client, normalized series cache, shared usage recorder and clock. It deduplicates exact route checkpoint coordinates, prefetches missing/stale series in bounded batches and separately matches each ETA. Provider parsing/network I/O stays in integrations/open_meteo; Redis cache/counters stay in cache/. No ORM operation is added to a service contract.

API composition constructs dependencies without I/O. Owner-scoped prefetch POST explicitly triggers synchronous acquisition; projection GET uses cache only. This preserves provider conservation before Phase 5 adds background planning/coalescing. Checkpoint geometry/timing remains the Phase 2 service's responsibility. No migrations, models, dependencies, environment values, frontend or risk algorithms are changed.

## Phase 4 assessment

RiskRepo/RiskService and RecommendationRepo/RecommendationService follow the required ABC/concrete/Pydantic convention. RiskService is pure: typed inputs become checkpoint categories/reasons and conservative interval summaries. Versioned constants live in config/risk_rules.py. RecommendationService receives checkpoint, weather and risk interfaces through explicit composition; it reads cached weather only and applies eligibility before lexicographic ranking. API ownership is resolved by TripService before evaluation. No endpoint calls another endpoint and no ORM/provider implementation appears in repo contracts.

No database model/migration or dependency change was required. Risk summaries are currently read projections. Future atomic AnalysisRun publication must persist the rules version, observations/reasons and recommendation together rather than reusing current-cache projections as historical evidence. No selected-route state or background job was introduced in this phase.

## Phase 5 lifecycle (supersedes current-cache projections above)

PlanningRepo/PlanningService owns queued analysis orchestration; RefreshRepo/RefreshService owns refresh, revision changes, activity, stop and scheduling. Both use Pydantic contracts and explicit composition. Celery task wrappers call services only. TripService delegates creation to injected PlanningRepo and keeps owner reads in TripStore. Obsolete synchronous trip publication helpers were removed; provider work occurs only inside the worker pipeline.

AnalysisStore owns all analysis/trip ORM operations. The service wraps creation/request in transaction/on_commit but issues no ORM queries itself. AnalysisRun is both durable candidate/outbox and completed snapshot: captures inputs/revision/version, stage/status, lease/token, attempts/delivery attempts, retry timing, sanitized errors, candidate routes and full typed result payload. Conditional uniqueness allows one queued/running candidate per trip; the trip row lock serializes mutations. Redis supplies expiring per-trip locks with ownership-aware Lua renew/release. Database tokens and revisions fence old workers even if Redis leases expire. Snapshot/current-pointer/RouteSnapshot publication is one transaction; rollback/failure leaves previous data intact.

Each forecast batch renews/checks the worker fence before provider I/O and before cache writes. Retry reuses candidate routing; same-revision refresh reuses fresh published geometry. Recommendation uses exactly the fetched WeatherResult captured for that job, not a second racing cache read. Completed projections read this stored payload. Present-day stale/input-revision overlays are separate from immutable evidence. No selected route is changed.

The single Beat task coordinates recently viewed active trips every minute and recovers expired leases/queued deliveries. Initial queued work is dispatched after commit; lost delivery is recoverable from the database, bounded independently of three provider attempts. Credential/configuration/invalid-input failures require owner action rather than periodic retry. No imports start workers or connect to providers. Live-test mode disables scheduler work. See API_CONTRACT.md for defaults and operational limits.

## Phase 6 independent corridor workflow

CorridorRepo/Service/Pydantic contracts own curvilinear spherical tube sampling, bounded acquisition, 49-frame assembly and read projections. Geometry helpers use full route arcs and geodesic destination offsets, with endpoint caps and overlap coordinate deduplication. ForecastCache and the existing Open-Meteo adapter/usage recorder are reused; corridor samples never replace route checkpoint sampling. Per-variable missing masks prevent null weather from becoming a safe/zero value.

CorridorStore encapsulates CorridorRun ORM queries, token leases, validity checks and publication. One unique record belongs to each completed AnalysisRun, storing the fixed anchor, separate status, dataset and sanitized failure. No heatmap frame is a separate database row. CorridorCache mirrors the immutable dataset with database fallback on cache miss.

Planning publishes core results first, then invokes the ancillary enqueue callback after commit. Callback failure cannot roll back core data; the periodic coordinator can recover missing ancillary outbox entries. Corridor Celery work runs on the corridor queue, with its own locks/status/fencing. Stop, input/current-version changes and inactivity prevent publication. Core route assessment never waits for corridor completion, and corridor GETs never call providers. See API_CONTRACT.md for sample method, clipping and resolution limits.

## Phase 7 frontend

frontend/src/app owns router/providers/shell; src/api contains typed backend contracts and the session/CSRF fetch client; features/trip-planner owns schema and accessible place search; styles owns CSS-variable day/night tokens and responsive layout; utils/time owns explicit IANA wall-time conversion. Server state belongs to TanStack Query, form state to React Hook Form/Zod. No frontend risk/ranking calculation is introduced.

A shared session-bootstrap promise prevents parallel place searches from racing anonymous ownership. Requests use same-origin cookies; unsafe writes include CSRF headers. Trips are created only by form submission; synchronous and submitted-state guards prevent duplicate POSTs, retries are disabled, and navigation preserves the mounted planner. Search cancels obsolete requests, requires explicit selection and retains visible field errors. Temporal disambiguation=reject avoids silently moving a departure through DST gaps/overlaps.

Development fixtures are explicitly gated by DEV and an opt-in flag; production builds reject the flag and tree-shake the fixture module. UI review never starts a backend/provider workflow. Phase 8/9 visualization/lifecycle features and complete API response shapes will be added as needed rather than unused scaffolding now.


## Phase 8 frontend projections

api/contracts.ts now types the frozen planning snapshot using the existing Python model fields. route-comparison/components renders backend route/risk/forecast projections; presentation.ts only formats units/time and gates current claims by server freshness/revision/eligibility flags. It never computes authoritative risk or ranks routes. MapLibre rendering lives in features/map/components with pure GeoJSON/bounds helpers in features/map/utils. Browser state owns only the inspected route/checkpoint and mobile view. The comparison is keyed by trip, not analysis version; updates do not remount the map or silently follow a changed recommendation. Route sources are updated in place, initial fit is guarded, theme styles rebuild layers without camera fitting, and hidden panels resize through ResizeObserver.

The basic Phase 7 status query feeds frozen results. A separate owner-scoped read-only routes query exposes working geometry while initial weather is pending; completed snapshots take precedence atomically. No additional weather fetch, live provider call, refresh/heartbeat orchestration or corridor timeline is introduced. All backend source/settings remain unchanged.


## Phase 9 cached corridor display and active-trip lifecycle

features/weather-timeline holds cached-frame selection, version alignment and display preferences; features/map/utils/corridorField.ts owns bounded disjoint field cells and geographic containment, not business risk decisions. The map updates frame source data in place; it never fits the camera for a frame or dataset refresh. A textual sample-value alternative includes coordinates and masks. App owns the trip/version-keyed corridor query and passes only synchronized data into the comparison. Existing route/checkpoint inspection remains independent.

useTripLifecycle coordinates visible/online analysis polling, explicit owner heartbeats, cooldown-aware refresh and stop. Query identity is stable across processing stages; old successful data remains in the same query during reassessment. On page inactivity it cancels reads (including working geometry), and stop disables ongoing polling/heartbeats. Mutation callbacks fence by trip identity to prevent an obsolete response affecting a new trip. Display preferences are the only new persistent browser state; completed inputs can be restored from the frozen snapshot without overwriting a dirty form.

Backend RiskService.assess now delegates its unchanged per-checkpoint rules to the pure classify_checkpoint helper. CorridorService.read uses that same helper to add sample-major combined risk arrays and a rules version to existing scalar datasets, using captured cargo load and preserving original stored/cache objects. No frontend business rules, provider acquisition changes, worker scheduling changes, models/migrations or dependency changes were introduced. The *_repo abstract contracts and dependency direction remain intact.


## Phase 10 release topology

The standalone production file prepares a private loopback static/API gateway behind external authenticated TLS ingress. Nginx serves SPA assets/notices and forwards /api/ with original Host and overwritten HTTPS scheme; Django trusts that scheme only within this private topology. Gunicorn serves the existing WSGI API without scheduling work. PostgreSQL/Redis have no host bindings on an internal data network; core/corridor workers have outbound connectivity, separate queues and grace for configured job limits. One Beat persists scheduler state. Dependency/image/source inventories are separate from secrets; migrations and backups are explicit runbook operations.

Production settings guard secrets/hosts, disable external-CDN API docs and use secure host-scoped cookies/clickjacking headers. HSTS intentionally excludes subdomains/preload until hosted review. API, service interfaces, calculations, persistence models and task behavior are otherwise unchanged. Frontend additions are linked attribution and reproducible production dependency notices, not new risk/refresh behavior. Quota review confirms shared weather accounting rather than an application-wide spending cutoff; see KNOWN_LIMITATIONS.md.
