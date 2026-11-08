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

- 2026-11-08, Phase 4: risk rules version 2026-11-08.v1 implements continuous weather thresholds, strict cargo >30k/>40k overrides, and unrounded lexicographic ranking.
- Missing coverage preserves known hazards, while otherwise Unknown stays unscored. Separate unassessed mileage can overlap category mileage and never participates as zero risk. Stale/incomplete routes are ineligible, averages null.
- Recommendation GET is an owner-scoped cached-data projection, preserving all alternatives and existing route snapshots. Durable assessed snapshot publication is deferred to Phase 5's consistency lifecycle; do not claim projection results are immutable historical assessments.

- 2026-11-08, Phase 5: replace synchronous creation with durable AnalysisRun outbox + post-commit Celery dispatch; return 202 and identifiers. Existing Trip/RouteSnapshot rows are preserved.
- Capture candidate inputs/revision, use per-trip Redis leases plus PostgreSQL fencing tokens/conditional uniqueness, and publish complete payload/current pointer atomically. Partial working routes are available initially but do not replace prior published analysis.
- Completed recommendation/checkpoint/weather projections read stored assessments. Separate stale/input-change overlays prevent expired recommendations from appearing eligible. Raw historical evidence is immutable.
- Only explicit heartbeats or manual refresh maintain viewer activity; status polling does not. Stop is permanent in this phase. PATCH accepts a full replacement input document and fences prior revision work.
- Transient retries capped at three; durable broker deliveries capped at five. Missing/invalid credentials and provider invalid-request failures block periodic retry. Initial fresh route candidates survive weather retries.
- No worker/Beat started during implementation; fake-clock workflows and local PostgreSQL/Redis smokes avoid live providers. Eight superseded synchronous/current-cache integration cases were replaced by Phase 5 queue/snapshot coverage; pure adapter/rule tests retained.

- 2026-11-08, Phase 6: corridor is an independent per-completed-analysis job/queue with immutable UTC-hour anchor and 49 frames. Core completion does not depend on corridor success.
- Use a bounded spherical tube grid rather than adding GIS dependencies: three perpendicular lanes and geodesic endcaps; merge overlapping visualization coordinates and double along-route spacing to meet 100-location cap. Report anisotropic spacing; consumer clips scalar interpolation to source route tubes. This visualization approximation does not coarsen authoritative checkpoints.
- Persist one bounded dataset JSON per CorridorRun and mirror it in cache. GET returns complete cached arrays/version, never provider requests per slider position. Nulls/masks remain explicit; no additive heatmap or independent recommendation recalculation.
- Corridor delivery recovery is bounded at five attempts; provider batch failure yields partial coverage without retrying. Processing lease expiry is a visible failure. A new core analysis produces a new corridor; no automatic unbounded corridor retries.
