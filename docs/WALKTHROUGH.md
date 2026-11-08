# RouteCast company walkthrough — eight minutes

Use the offline fixture preview for the walkthrough unless a separate bounded live demonstration has been authorized. State that the banner/data are synthetic and do not describe current roads/weather. No secret, real trip, provider dashboard key or resolved environment output belongs on screen.

| Time | Demonstration | Explanation |
| --- | --- | --- |
| 0:00–0:45 | State the planning problem and scope | Compare up to three truck routes by weather exposure and cargo rules. No GPS tracking, account registration or certified navigation claim. |
| 0:45–1:45 | Show the planner; keyboard-select explicit locations, timezone-aware departure, cargo pounds and 10/25/50-mile spacing | Cargo is separate from gross vehicle weight. Ambiguous DST times and invalid/past inputs are rejected; requests are explicit and duplicate guarded. |
| 1:45–2:45 | Open /trips/preview-trip in fixture mode; inspect A/B/C | Point out recommended vs selected state, Severe/High miles, risk distribution, coverage and the backend explanation. A blocked route remains inspectable; missing variables stay Unknown. |
| 2:45–3:45 | Select a route/map line and open a checkpoint | Explain distance-scaled great-circle sampling, maneuver-time interpolation or labeled proportional fallback. Show ETA vs hourly accumulation interval, wind samples, units, freshness and exact cargo overrides. |
| 3:45–4:45 | Change cached corridor layer and hour with keyboard | All 49 frames were acquired together; no API request per drag. Fixed legends and conservative clipped, non-additive cells show sampled scalar data. Forecast hour never changes checkpoint-ETA recommendation. |
| 4:45–5:45 | Refresh, show retained data, then stop updates | New versions publish atomically; old completed results remain usable. Absolute time is preserved when possible; route selection stays independent. Visible-page polling and heartbeats maintain viewer activity; stop fences jobs without losing results. |
| 5:45–6:45 | Show the architecture and service files | React → same-origin Django Ninja → injected PlanningService → routing/checkpoint/weather/risk/recommendation interfaces. *_repo.py is ABC signatures only; concrete *_service.py inherits it; Pydantic contracts separate from Django persistence stores. Celery workers run core/corridor independently; one Beat coordinates retries/refresh. |
| 6:45–7:30 | Show deployment diagram/runbook and verification ledger | Production assets + private Nginx/Gunicorn + PostgreSQL/Redis + separate workers/Beat, HTTPS ingress supplied by host. Exact lockfiles, offline fixtures, targeted checks and documented live gaps. Nothing has been deployed. |
| 7:30–8:00 | State tradeoffs and remaining evidence | Provider/broker/hosted checks, access/cost controls, commercial endpoint terms, sampling limits, anonymous recovery and manual accessibility review. Invite focused questions about rules, geometry, caching or job fencing. |

## Presenter preparation (local only)

Start the fixture UI with VITE_USE_FIXTURES=true, Django/workers not required. Existing fixture page is /trips/preview-trip; ?fixture=stale, partial, blocked and cooldown cover failures without live APIs. Fixture refresh publishes its next version on a later status read; fixture stop state is in-memory and resets on reload. Display theme/layer preferences persist. Confirm the visible synthetic banner before sharing a screen. Read VERIFICATION_LOG.md before running any tests; do not repeat successful provider checks for a presentation.

Useful repository anchors: api/dependencies.py (composition), services/checkpoint/checkpoint_service.py (geometry/timing), services/risk/risk_service.py and config/risk_rules.py (exact rules), services/planning/planning_service.py (publication/fencing), services/corridor/corridor_service.py (49-frame dataset/read projection), frontend/src/features/weather-timeline and map (cached display), docs/API_CONTRACT.md and DEPLOYMENT.md.
