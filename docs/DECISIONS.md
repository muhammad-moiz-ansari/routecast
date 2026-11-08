# Decisions

- 2026-11-08: Phase 0 only; Python 3.12, Django 5.2 LTS, Ninja and Pydantic 2. Bounded direct dependencies and uv.lock resolve exact versions. No frontend lockfile until its phase.
- Health is a small concrete service demonstrating the required repo/service/model convention, without fake domain methods.
- PostgreSQL 17 and Redis 7 local containers bind to loopback. Image tags are explicit; deployment hardening is deferred.
- SQLite is solely offline test infrastructure. It is not a runtime replacement for PostgreSQL.
- Celery entry point is `config.celery:app`; no package-level auto-import, task scheduling or provider requests.
- Root .env configures Compose; backend/.env configures Django. Existing environment variables take precedence. Align database credentials manually; examples never include provider keys.
- User prohibits staging/committing; lockfiles are generated and left unstaged despite the plan's wording about committing them.

- 2026-11-08, Phase 1: synchronous routing and 201 creation until queued planning is implemented in Phase 5. Do not pretend a job was enqueued.
- Anonymous ownership uses server-side session owner UUIDs; bootstrap GET /session/ returns CSRF token; protected POST uses Django Ninja cookie-auth CSRF checks.
- Trip inputs and bounded normalized route snapshots use PostgreSQL JSON fields; snapshots publish atomically after provider I/O. Raw provider payloads are not retained.
- TripStore owns the initial trip/snapshot persistence together to keep publication atomic; no unused separate route store is scaffolded.
- No fabricated truck dimensions/gross weight. Idempotency keys, distributed quota accounting and retries remain later work; clients must submit once explicitly.
- Plans were found/read in the parent directory after being moved outside the repository. They were not recreated or changed.

- 2026-11-08, Phase 2: generate checkpoint projections deterministically from owned stored route snapshots; no checkpoint persistence or data migration is needed before assessed snapshots are introduced.
- Keep provider road distance as authoritative cumulative chainage. Measure the full polyline on a mean-radius sphere, then scale its chainage to provider total. This reconciles route/interval mileage and maneuver timing; expose both measured length and distance_method so the approximation is explicit.
- Request coded maneuver guidance inside the existing routing call (no additional provider calls). Normalize monotonic offsets/times, anchor to route totals, and label missing/invalid timing as proportional_distance; old snapshots do not require refresh.
- Reject unsampleable geometry or more than 10,000 intervals with a clear checkpoint error; do not silently reduce spacing or fabricate coordinates.

- 2026-11-08, Phase 3: use explicit owner/CSRF protected weather prefetch POST and cache-only GET until queued planning in Phase 5; never silently fetch weather from projection reads.
- Normalize hourly accumulations on (t-1h,t]; exact-hour wind uses one sample, interior-hour wind the larger bracketing value. Missing variables stay null; actual timestamp coverage controls availability.
- Request the public provider's 16-day maximum plus one past day; retain exact-coordinate normalized series 24h, mark fresh for 15min, and reuse for changed ETAs. No extra request to chase out-of-horizon ETAs.
- Share daily attempted request/location/estimated-unit counters in Redis. Estimated units are not a provider billing claim. Distributed locks/coalescing/quota enforcement and paid endpoint configuration are not implemented in this phase.
