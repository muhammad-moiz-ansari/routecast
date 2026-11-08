# Architecture

Phase 0 implements Django configuration, Django Ninja API registration, health operations and shared helpers. API routes call services through `api/dependencies.py`. HealthService inherits HealthRepo and receives explicit probe callables; construction performs no network I/O.

For each implemented service use `<name>_repo.py` (ABC signatures only), `<name>_service.py` (concrete subclass), and `models.py` (Pydantic contracts). Public methods and interface methods have concise docstrings. Comment decisions rather than restating assignments. Health is the first real service; future services are not empty scaffolds.

ORM operations belong in `persistence/stores/`; only `persistence` is a Django model application. `persistence/models.py` is reserved for future ORM entities, separate from service schemas. No domain tables or migrations are needed yet; Django's auth/session migrations establish the local database.

Dependency direction: routes → service interfaces → injected infrastructure/other interfaces. Integrations will own provider HTTP, stores own database access, cache adapters own Redis. Tasks will call services. No endpoint calls another endpoint internally. Celery has an explicit entry point, JSON serialization, UTC, and an empty Beat schedule. No import starts workers or contacts dependencies.

Production/local use PostgreSQL and Redis. Offline tests deliberately use SQLite and memory cache; readiness's real adapters are independently exercised using fakes. Readiness executes SELECT 1 and Redis PING only, exposes booleans, and uses bounded timeouts. Liveness requires neither dependency. Future ownership, throttling, provider adapters, risk calculations and UI remain unimplemented.

Shared helpers reject nonfinite/negative quantities and naive times, normalize instants to UTC, and preserve IANA display timezones. Unknown is a data quality category, not a zero risk score. Units remain explicit; converting precipitation depth does not establish an hourly rate. Future GeoJSON uses [longitude, latitude].

Frontend implementation is deferred to Phase 7; use the companion design specification then. Do not install frontend dependencies early.
