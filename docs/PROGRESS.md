# Progress

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

## Separate UI redesign — UI-1

9 November 2026 follow-up: refined enabled-button hover/focus feedback, meaningful authored workflow/forecast illustrations, holo card treatment, smooth FAQ opening/closing and anchor scrolling. Durable future-phase preferences are in docs/UI_INTERACTION_GUIDELINES.md and linked from the handoff. See UI1-POLISH verification entries. UI-2/UI-3 remain unstarted.

9 November 2026: UI-1 implemented and verified using offline fixtures. Complete branded landing, shared day/night theme/tokens, self-hosted Manrope, explicit landing/planner/trip/not-found routing and controlled accessible illustrative motion are recorded in [UI redesign progress](UI_REDESIGN_PROGRESS.md). UI-2/UI-3 are not started. Original phases 0–10 and their pending release gates remain unchanged. See UI1 verification entries; zero routing/weather/basemap requests. Stopped after UI-1 without Git or deployment actions.
