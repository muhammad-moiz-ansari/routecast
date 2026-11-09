# Progress

## Planner calendar and visual refinement — 9 November 2026

Added a themed departure calendar dialog with month navigation, day selection, local time, Today/apply controls, arrow/Home/End navigation and Escape/focus return. Native editable datetime segments remain as fallback; existing Temporal timezone/DST interpretation is unchanged. Replaced stacked input outlines with primary-border/blue-teal glow and forced-colors fallback; centered compact navbar controls and removed extra workspace top padding. Sidebar now has restrained static teal/blue gradient atmosphere. No provider/backend behavior changes, dependency additions or live API checks. Three focused offline tests and TypeScript pass; browser fixture preview timed out, so rendered visual confirmation remains pending. User reference URLs were inaccessible through web browsing; no visual review of them is claimed.

## Shared API usage limits — 9 November 2026

Implemented user-selected provider quota protection. Shared durable PostgreSQL caps now guard every TomTom search/routing request and Open-Meteo core/corridor batch before HTTP, with minute/hour/day/calendar-month limits and fail-closed storage handling. Conservative defaults, weighted weather units, no failed-request refunds, read-only provider_usage inspection, sanitized HTTP 429/Retry-After and readable background quota notices are documented in API_USAGE_LIMITS.md. Scheduler excludes budget errors from automatic reassessment; saved snapshots remain usable. Environment templates document optional limits; no private credentials changed.

Implementation/offline verification complete; local activation remains pending. Agent's PostgreSQL readiness probe returned false, so migration 0004 was not applied and user workers were not restarted. User must stop Django/workers, migrate in the working terminal, inspect usage, then restart. No live provider calls, account changes, Git mutations or deployment. Quotas cover this database's future reservations, not historical/provider-dashboard/external-app use or per-owner abuse; real PostgreSQL concurrency remains unverified.

## Current local setup checkpoint — 9 November 2026

User confirms OpenFreeMap basemap is visible and an Argentina trip shows stronger winds with forecast-hour changes. Earlier user confirmations establish real trip processing and corridor display on Pakistan routes. These are user-observed local integration results, distinct from agent-run offline checks; no new live calls were made to repeat them. Local provider setup is operational by user report. The later worldwide-search refinement has offline regression evidence only. Oracle deployment remains deferred at user direction. Next development priority is awaiting selection; no additional phase or large feature is inferred.

## Worldwide search relevance — 9 November 2026

TomTom search still uses one predictive request and no country restriction. The adapter now requests 10–20 candidates, ranks token-prefix/locality matches before applying the requested output limit, removes identical label/coordinate duplicates, and includes POI names and country context in labels. Accent-insensitive comparison preserves original display text/coordinates; ties preserve provider order. No country list/database, new key, dependency or endpoint contract is needed. Synthetic Lahore/Pakistan and Córdoba/Argentina examples pass; improved live relevance remains unconfirmed and depends on provider candidate coverage. Existing selections stay explicit; no automatic coordinate selection or new trip creation.

## Basemap setup and compact map markers — 9 November 2026

Configured previously empty ignored frontend/.env.local day/night style URLs to OpenFreeMap Positron/Dark, matching the zero-budget request without exposing backend TomTom credentials. No new dependency or production configuration changes. Cluster circles reduced from 16px to 8px radius; selected-point ring reduced from 19px to 12px. Separate transparent 22px cluster hit target preserves interaction. Configured basemaps no longer show an informational status pill; geometry-only notice remains when unconfigured and genuine map errors remain visible. Remote asset/visual verification pending user's local reload; no agent live basemap/provider checks.

## Live-route patchy overlay correction — 9 November 2026

User screenshots exposed tiny forecast patches on detailed live routes. Root cause in renderer: sample support was restricted to nearest geometry segment plus/minus one segment, making coverage depend on the provider's vertex density. Replaced segment-count proximity with projected spherical chainage proximity bounded by forecast sample spacing; Euclidean/spherical sample radius, same-route restriction, missing masks, clipping, palette and categorical maxima remain. No new provider requests or data acquisition; reload the existing trip to discard old raster/support caches. The configured corridor still represents a narrow route buffer, with missing/unsupported regions transparent.

## Processing presentation — 9 November 2026

Fixed the processing card's clipped icon by replacing unsafe vertical centering with scroll-safe content and auto margins. Added subtle stage-dot connectors, active-step semantics and a decorative glowing SVG route trail behind the content. Motion runs only during active processing, pauses on errors/terminal/stopped states, and becomes static for reduced-motion users. No per-frame React work, dependency changes or provider requests. Existing backend stage text remains authoritative.

## Forecast performance and map space — 9 November 2026

Visual follow-up: lowered the planner header action group by 3px at user request; the navbar stays 48px and button targets remain 44px.

Replaced exhaustive per-pixel route-segment scanning with a spherical bounding-sphere hierarchy and exact nearest-arc checks. Dense live road geometry was an unbounded multiplier of the first-frame pixel workload; distant branches can now be skipped without route simplification. Existing frame/geometry caches, resolution, missing masks and risk semantics remain. Navbar reduced from 76px desktop/68px mobile to 48px with 44px controls; removed the planner workspace footer at user request. No live API calls. Actual live-trip speed/device validation remains pending.

## Shared disclosure follow-up — 9 November 2026

Assessment timing, trip input details, forecast sample values and landing methodology now reuse AnimatedDisclosure with right-to-down chevrons, smooth opening/closing, inert collapsed panels and reduced-motion support. Extracted shared CSS from landing styles so direct planner visits receive the same behavior; compact variants fit the planner. No native details/summary disclosures remain. Navigation menus, autocomplete and map/sidebar controls retain their distinct semantics. User reports a real route completed; no heatmap is expected until the separate corridor job runs. Corridor worker startup remains a user action, with at most two weather requests/100 locations for a single queued analysis; periodic scheduling should remain disabled during setup.

## Deployment setup in progress — 9 November 2026

Live-mode setup follow-up: screenshot showed synthetic selections despite frontend/.env.local already setting fixtures false. Added `npm run dev:live` to force fixture mode off before Vite environment loading and refuse a silently different port when the old server is still running. Fixture autocomplete now offers named places for prefixes with distinct stable synthetic endpoints, fixing Lahore/Faisalabad preview validation. Existing real autocomplete already searches at two characters after a 300 ms pause; no live search or provider contract changes made. Restart the old frontend server and clear the two synthetic selections before live testing.

User-terminal provider checks subsequently passed: TomTom search parsed three suggestions, truck routing returned three Lahore/Faisalabad routes, and Open-Meteo returned 408 hourly records for one location. Search relevance is still poor for Lahore Pakistan and needs a focused follow-up. Reuse these isolated checks; they do not establish full queued trip/corridor behavior. Hosting remains deferred while local setup continues.

Local backend environment detects the configured key and live-test mode. User reports PostgreSQL/Redis readiness passing. Three bounded isolated provider attempts (one search, one route, one weather location) all returned provider_unavailable from this agent session; provider credentials/response contracts remain unverified. No retries or workers started; next step is checking outbound connectivity from the user's terminal. No deployment.

User requested API-key setup and deployment with a zero monthly budget, preferring Vercel if practical. Created ignored `.env.production` from the template with unique generated Django/database secrets, blank TomTom key, placeholder hostname and periodic scheduling disabled. No existing credentials were read or overwritten. Hosting and provider account signup are pending user action; nothing has been deployed.

Vercel Daemons beta supports Celery on Hobby, but its monthly memory quota cannot sustain even one minimum-size daemon all month. Existing topology needs two workers, Beat, PostgreSQL and Redis. Oracle Always Free VM is a candidate for the existing Compose stack; card verification, regional capacity and reclamation conditions apply. User's willingness to use card verification is pending. This assessment does not replace remaining runtime release checks.

Current phase: **Phase 10 implementation/release preparation complete.**
Completed implementation phases: 0–10. No further phase is started or inferred; wait for explicit user instructions.

## Release package

Prepared standalone production Compose topology: private loopback Nginx static/API gateway, Gunicorn 26.2.0 locked backend image, PostgreSQL/Redis on an internal network, separate core/corridor Linux workers and one persistent Beat. Containers use nonroot application processes/read-only app filesystems; API readiness gates gateway startup. Sources are allowlisted/real environments excluded; migrations and service startup are explicit authorized release steps, never build/entrypoint side effects.

Production settings fail closed on weak/development secrets or wildcard/missing hosts, use secure __Host- session/CSRF cookies, controlled proxy HTTPS handling and clickjacking headers, and disable CDN-based API docs. One-hour host-only HSTS deliberately excludes subdomain/preload enrollment until hosted review. Same-origin Host/Origin/CSRF behavior is verified offline. Aggregate gateway admission limits are configured; they are not daily/provider-owner quota enforcement.

Rewrote historical README/provider guidance to match actual Phases 0–10 behavior. Added deployment/static-serving/backup/migration/rollback/process runbook, source attribution, known limitations, eight-minute company walkthrough and missing-live-evidence checklist. Linked weather/provider/licence credit appears beside map/timeline and checkpoint values. Browser distributions include 71 resolved production dependency notices with a build-time drift check.

## Verification

Eight new production configuration/readiness tests pass across targeted runs, plus affected existing local API docs/liveness and checkpoint-dialog cases. Production deploy check has no errors and only the two documented HSTS subdomain/preload warnings. Changed backend lint, offline uv lock consistency, frontend TypeScript/production build, 71 licence notices, production fixture exclusion, tracked-environment inventory and ignore checks pass. Production YAML parsed; private exposure, queues and readiness wiring reviewed statically. This is not Docker Compose/image/runtime execution evidence.

Actual fixture browser review confirmed new linked credits, visible keyboard focus, modal Escape/focus return and 320px reflow; prior broader UI/contrast/risk/cache/lifecycle evidence reused. Viewport reset and owned preview stopped. Routing/weather/basemap requests and live backend checks: zero. PyPI resolution, official documentation and one missing upstream MIT licence download were setup/reference traffic only. See P10 records for fingerprints, retest reasons and resolved failures.

## Remaining release gates and limits

Docker unavailable here: image builds, Docker Compose CLI validation, Nginx image syntax, Linux Gunicorn/worker startup, hosted HTTPS/CSRF, backup/restore rehearsal and real broker/provider E2E remain pending. Image family defaults must be replaced with approved immutable digests for a chosen release. Manual screen-reader/device/enlarged-text/zoom review remains pending; no full WCAG claim. Existing MapLibre/Zod build notices remain nonfatal.

This prepares a controlled noncommercial assessment behind user-supplied authenticated HTTPS ingress, not unrestricted public/commercial service. Weather counts are accounting only; global daily cutoffs, shared TomTom accounting and per-owner quotas are absent. The implemented public Open-Meteo endpoint is noncommercial; paid/customer endpoint support is absent. Provider account/usage/storage/attribution terms must be confirmed. No real credentials were inspected or changed.

Sampling/ETA limitations, polar text-only corridor samples, anonymous session recovery, absent backend creation idempotency, unsaved draft/place-label/display-time persistence and omitted optional playback remain documented in KNOWN_LIMITATIONS.md. No changes to business rules, ORM models/migrations, actual persisted trips or worker scheduling behavior.

Stopped after Phase 10. Nothing staged, committed, pushed, published or deployed. The user owns release authorization and all Git operations.

## Separate UI redesign

Latest update, 9 November 2026: **UI-2 complete**, including shared specular planner CTAs, extracted planner presentation, scrollable route sidebar beside the map, forecast dock, checkpoint drawer/list, searchable timezone choice and responsive panel navigation. [UI redesign progress](UI_REDESIGN_PROGRESS.md) and UI2 verification entries record the evidence and limitations. UI-3 remains unstarted; the existing weather-cell renderer is retained. Zero live provider calls; no Git or deployment actions. Stopped after UI-2.

9 November 2026 follow-up: refined enabled-button hover/focus feedback, meaningful authored workflow/forecast illustrations, holo card treatment, smooth FAQ opening/closing and anchor scrolling. Durable future-phase preferences are in docs/UI_INTERACTION_GUIDELINES.md and linked from the handoff. See UI1-POLISH verification entries. UI-2/UI-3 remain unstarted.

9 November 2026: UI-1 implemented and verified using offline fixtures. Complete branded landing, shared day/night theme/tokens, self-hosted Manrope, explicit landing/planner/trip/not-found routing and controlled accessible illustrative motion are recorded in [UI redesign progress](UI_REDESIGN_PROGRESS.md). UI-2/UI-3 are not started. Original phases 0–10 and their pending release gates remain unchanged. See UI1 verification entries; zero routing/weather/basemap requests. Stopped after UI-1 without Git or deployment actions.


UI-3 completed 9 November 2026: smooth bounded worker-rendered weather rasters replace operational polygon cells. See UI_REDESIGN_PROGRESS.md and UI3 verification records for checks and support/fallback limitations. No backend/provider/ranking changes, no live provider calls, no Git/deployment actions. Stopped after UI-3.
