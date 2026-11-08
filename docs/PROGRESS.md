# Progress

Current phase: **Phase 5 complete — queued analysis and controlled refresh lifecycle.**
Completed implementation phases: 0–5. Next phase: 6, only upon explicit user request.

## Implementation

PlanningRepo/Service coordinates staged routing → checkpoints → weather → assessment → atomic publication. RefreshRepo/Service coordinates coalesced manual/periodic requests, full input revision replacement, explicit viewer heartbeat, inactivity expiry and permanent stop. Celery tasks delegate to services; one Beat task coordinates scheduling/recovery every minute. No web/import-time background loop or provider calls.

AnalysisRun captures input/revision/version, stage/status, attempts/dispatch timing, lease/fencing token, sanitized error, working routes and full completed assessment. Trip points to the current completed run. Conditional uniqueness plus trip row locking allows one active candidate; token-owned expiring Redis locks renew across stages and weather batches. Old revisions, stopped/inactive trips and expired tokens cannot publish. Candidate payload/current pointer/RouteSnapshot update in one transaction; failures preserve prior completed data.

Initial creation now returns 202 and analysis identifier. Refresh coalesces, enforces 60-second cooldown and uses 15-minute route reuse/weather defaults; explicit activity expires after 30 minutes. Transient worker attempts capped at three; broker delivery attempts at five; invalid credentials/configuration/requests do not auto-retry. Candidate routes survive transient weather retries. Stopped work cannot be restarted by heartbeat. Live-test mode disables periodic scheduling.

## API changes

Added analysis GET with private ETags/304, heartbeat/refresh/stop POST and full-input PATCH. Existing recommendation/checkpoint/weather GETs read completed snapshots. Stale/input-mismatched recommendation projections withhold current selection/eligibility but expose the previous recommended ID and retained data. Prior route snapshots remain readable; historical trips need explicit activity/refresh for new durable assessment. See API_CONTRACT.md for all contract changes, status/version semantics and legacy compatibility.

## Verification

16 new fake-clock/offline lifecycle cases plus 2 affected foundation checks pass across targeted executions. Covers coalescing, worker/delivery retry bounds, token expiry, revision/stop cancellation, inactive viewer scheduling, stages, weather batch cancellation guards, atomic rollback/publication, cache-independent projections, stale display, owner/CSRF, ETags, cooldown and PATCH. Router shadowing on PATCH was found and corrected; failed/affected checks were selectively repeated. Django configuration, migration consistency and final lint pass.

New 0002 migration applied to local PostgreSQL. Real Redis token/Lua smoke passed. Real PostgreSQL uniqueness + fenced publication + JSON roundtrip passed using offline providers and rolled-back synthetic data. External provider API calls: 0. Dependencies/lockfile/real environment unchanged; optional example settings added. Eight superseded synchronous/current-cache integration cases replaced by Phase 5 lifecycle coverage; unchanged provider/geometry/weather/rule evidence reused.

## Limitations / pending evidence

Real Celery broker/worker/Beat end-to-end process execution remains unverified; no workers/Beat were started. Earlier live TomTom/Open-Meteo evidence remains pending. Worker and single-Beat operating commands are in README; starting workers executes queued provider work. Windows solo is for local development; use supported Linux workers for reliable task time limits.

Coalescing is per trip; simultaneous different trips may still request the same provider location. Shared forecast cache and usage counters exist, but distributed provider-wide quota enforcement is not added. Durable delivery is bounded: exhausted jobs fail visibly and require later owner action. A provider request already in flight cannot be recalled; fences prevent stale publication/cache writes afterward. Analysis retention cleanup is not automated. POST creation still lacks idempotency keys; clients must avoid duplicate submissions. PATCH is full replacement; stop has no resume endpoint.

Previous forecast horizon, spherical route sampling, weather/risk approximation and anonymous-session recovery limits remain. No corridor dataset or frontend work added.

Stopped after Phase 5. Nothing staged, committed, pushed, published or deployed. Wait for the user's Phase 6 request.
