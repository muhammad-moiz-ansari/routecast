# Provider setup — Phases 1–2

TomTom key is server-side only. Set `TOMTOM_API_KEY` in the existing ignored backend/.env when you choose to enable live search/routing. Never overwrite an existing environment file or put this key in frontend variables. Restart the backend after changing it. Missing keys produce `provider_not_configured`, with no outbound request. No live calls were made during implementation; adding a key does not authorize a test.

Adapters use one HTTPS request, 3-second connect and 15-second read/write/pool timeouts, no redirects, no retries, and at most four in-flight HTTP requests per process (one-second capacity wait). Numeric Retry-After is exposed on 429. Shared distributed quota accounting, request coalescing, user throttling and retry policy are future work; this per-process limit is not a shared provider allowance. These endpoints should remain local until later production controls are added.

Search uses [TomTom Fuzzy Search v2](https://docs.tomtom.com/search-api/documentation/search-service/fuzzy-search), typeahead and a bounded result limit. Routing uses [Calculate Route v1](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route), truck travel mode, departure and maxAlternatives=2. Provider coverage and truck restrictions vary; no region-specific coverage claim is made. Without vehicle dimensions/gross weight, results cannot validate every truck restriction. Cargo pounds must never substitute for gross vehicle kilograms.

Synthetic fixtures live only under backend/tests/fixtures and use HTTPX MockTransport. Runtime code has no fixture mode or fixture fallback. Open-Meteo is not integrated until Phase 3.

Live search/routing contract evidence remains pending. Before any necessary live check, read VERIFICATION_LOG.md, explain the missing behavior and why fixtures are insufficient, and announce a maximum of one search and one routing request (no retries). Do not automatically spend that budget now.

## Phase 2 timing

The existing Calculate Route request now includes `instructionsType=coded` to obtain maneuver timing without human-readable instruction text. The [v1 guidance contract](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/guidance-instructions) defines `routeOffsetInMeters` and `travelTimeInSeconds` as cumulative distance/travel time to the instruction. Those fields are normalized and persisted with the route snapshot. Provider timing availability is not guaranteed: missing/invalid values use a visible proportional-distance ETA fallback. Existing snapshots need no provider refresh. No live routing contract test was run for this optional guidance parameter; that evidence remains pending.
