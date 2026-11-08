# Progress

Current phase: **Phase 8 complete — route comparison and interactive map.**
Completed implementation phases: 0–8. Next phase: 9, only upon explicit user request.

## Implementation

Added MapLibre GL JS and exact package-lock resolutions; geographic rendering and pure geometry helpers live under features/map, comparison/details under features/route-comparison. Typed frozen backend snapshot contracts cover route/checkpoint/weather/risk/recommendation data. No risk scoring or ranking moved into React. Working geometry can appear while weather is pending through one read-only routes query per candidate; frozen completed data takes precedence.

Route rows show identity, distance/duration/arrival timezone, Severe/High miles, labeled risk distributions, coverage, notices, eligibility and backend recommendation explanation. Current recommendation is withheld on stale/retained/revised/offline views; historical data remains inspectable. Inspection is independent of recommendation and survives updates; a disappeared ID is explained. Blocked routes remain inspectable and are never made eligible by selecting them.

Map renders available geometries with stable A/B/C identity labels, selection casing, blocked/unassessed dash treatment, selected-route checkpoint risk symbols, clustering, large hit targets and explicit Fit routes. Initial fit only; selection/updates/theme changes preserve camera. Licensed day/night style URLs are configurable with source attribution, but no default provider is silently contacted. Missing configuration uses a clearly labeled geometry-only background. Fixtures always force the local style. Map failure leaves the textual route/checkpoint alternative usable.

Checkpoint table/details show ETA, timezone, distance, matched forecast intervals/wind sample times, units, cargo/load rules, fetch time/freshness and missing-data warnings. Escape, visible close controls and focus return are supported. Mobile Planner/Routes/Map navigation keeps state mounted; tables stack on mobile/tablet. System/day/night foundation retained.

## Verification

11 new unique offline cases pass across targeted runs. Stored fixtures are generated/validated using the existing backend's pure checkpoint/risk/ranking services with no providers/database. Final TypeScript/production build passes; fixture data is excluded. Actual browser review covered mobile 320, tablet 768 and desktop 1280/1440/1600, both themes, selection from list/map, checkpoint details, keyboard/Escape, partial/stale/no-eligible states. Twelve new risk text contrast pairs pass (minimum 6.80:1). No broad prior successful checks repeated; see P8 verification records for failures resolved and retest reasons. Provider and basemap API/asset calls: zero. Temporary viewport reset and preview stopped.

## Limitations

No hosted basemap is chosen/configured or live-verified; optional public day/night style URLs and their license/attribution must be supplied for geographic street context. Geometry-only mode remains usable. MapLibre's lazy engine chunk emits the >500k build advisory; existing Zod annotation notices remain nonfatal.

Real frontend/backend/worker/provider E2E, manual screen-reader/device/enlarged-text/zoom review and full WCAG conformance remain unverified. Prior live provider/worker limitations remain pending. Corridor timeline, heartbeat/refresh/version synchronization and full reload restoration are Phase 9 work; not implemented here. Backend still has no creation idempotency key. No real environment/credentials or backend implementation/data changed.

Stopped after Phase 8. Nothing staged, committed, pushed, published or deployed. Wait for the user's Phase 9 request.
