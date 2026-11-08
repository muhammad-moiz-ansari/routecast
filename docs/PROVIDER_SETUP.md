# Provider setup and actual limits

Current through Phase 10, reviewed 9 November 2026. Configure existing ignored environment files privately; never overwrite credentials. Adding a key does not authorize a provider check. No live routing/weather contract smoke has been performed by the agent; see the verification ledger.

## TomTom

TOMTOM_API_KEY is backend-only. Missing keys fail before outbound I/O. [Fuzzy Search v2](https://docs.tomtom.com/search-api/documentation/search-service/fuzzy-search) uses typeahead and bounded result count. [Calculate Route](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route) uses truck mode, departure, maxAlternatives=2 and instructionsType=coded. [Guidance](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/guidance-instructions) supplies cumulative offsets/times when available; a labeled proportional fallback handles missing/invalid timing. No vehicle dimensions/gross vehicle mass are invented from cargo load. Provider coverage, alternative count and truck restrictions vary.

Transport uses one HTTPS request per adapter call, connect 3s/other 15s limits, no redirects/client retries, at most four in-flight calls per process and sanitized errors. Numeric Retry-After is retained. This per-process limit is not a shared account allowance. No shared TomTom daily counter or hard application spending limit is implemented. Configure account restrictions/usage monitoring and confirm storage/attribution terms before release; this repository does not hard-code advertised free plan allowances.

## Open-Meteo

The adapter uses https://api.open-meteo.com/v1/forecast with hourly wind_speed_10m, rain, showers and snowfall; UTC timestamps, metric precipitation and km/h wind. Metadata/array/hourly cadence/finite values are validated. Null remains missing, rain includes showers only when both exist, snowfall depth is converted rather than treating water equivalent as snow depth. See API_CONTRACT.md and RISK_RULES.md for interval/load semantics.

[Current terms](https://open-meteo.com/en/terms) restrict free API use to noncommercial use; [licence](https://open-meteo.com/en/licence) requires attribution, licence link and indication of changes. Linked credit is included where weather is displayed. Customer/paid endpoint configuration is not implemented, so company/promotional commercial release must resolve this separately. No API key is required for the implemented public endpoint.

Transport bounds each batch to 50 locations, two in-flight calls per process, connect 3s/other 20s, no redirects/client retries. Exact-coordinate series are reused fresh for 15 minutes and retained 24 hours; no coarse coordinate substitution. Weather attempt/location/estimated-unit counters are shared in Redis with two-day retention. These are accounting only: daily hard cutoff and per-owner budget enforcement are absent. Core checkpoint acquisition is independent of the <=100-location corridor cap. A longer trip can use more checkpoint locations than that cap; estimated units are not a billing promise.

## Jobs and verification

Only explicitly queued worker jobs acquire forecast/routing data; geocoding remains an explicit search operation. One Beat coordinates eligible viewed trips, 15-minute reassessment, cooldown/recovery and bounded retries. ROUTECAST_LIVE_TEST_MODE=true disables periodic scheduling, not queued creation/manual jobs. Do not start workers/Beat as an unannounced live check. Planning allows <=3 controlled transient attempts; corridor batch failure yields partial coverage rather than retries to force completeness. Token leases/publication checks do not recall an HTTP request already in flight. No GET or slider movement fetches providers.

Development fixtures are opt-in frontend/test only, labeled synthetic and production-forbidden; runtime backend has no fake provider fallback. See LIVE_API_CHECKLIST.md for the missing bounded adapter checks. Container/network/worker E2E remains pending. Private ingress/admission limiting/account restrictions are required for controlled assessment; unrestricted public release needs further quota/abuse controls.
