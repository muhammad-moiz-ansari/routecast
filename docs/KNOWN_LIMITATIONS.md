# Known limitations and release evidence

Current through Phase 10 (9 November 2026). Implementation preparation is complete; unrestricted public/commercial operation is not verified.

| Area | Actual limit / outstanding evidence |
| --- | --- |
| Hosting and containers | Docker/daemon unavailable in the agent environment. Production YAML parsed and security/contract checks run offline; image builds, Nginx syntax inside its image, Linux Gunicorn/worker startup, HTTPS ingress, deployment and backup/restore execution remain pending. Base-image defaults are mutable family tags; record approved immutable digests for a selected release. |
| End-to-end runtime | Real broker/core worker/corridor worker/single Beat flow and live provider contracts remain pending. Prior local PostgreSQL/Redis evidence is recorded and reused. No live smoke is silently substituted with fixtures. |
| Provider access and terms | No account balance/coverage/terms validation or secrets inspection. Current Open-Meteo adapter targets its noncommercial public endpoint; commercial/customer endpoint support requires separate work. TomTom vehicle dimensions/gross vehicle weight are absent, so full truck restrictions cannot be certified. |
| Cost and abuse | Weather attempt counters, caching, job leases, retries/cooldowns and process limits exist. Global daily hard quotas, shared TomTom accounting and per-owner enforcement do not. Gateway aggregate admission limiting does not replace account-level quotas. Keep a controlled assessment behind authenticated ingress; unrestricted public release needs additional protection. |
| Forecast and risk | Provider data may be missing/stale/out of horizon. Sampling/ETA interpolation does not prove continuous conditions or arrival accuracy. Unknown never supplies a safe clearance; No Travel routes stay inspectable but ineligible. This is a planning assessment, not certified navigation/dispatch or in-driving interaction. |
| Corridor | Conservative disjoint cells are sparse and can leave gaps. Samples beyond 85 degrees are text-only. Selected-time scalar/combined risk is separate from checkpoint ETA assessment; current rule version is reported. No optional playback. |
| Accessibility | Keyboard/focus, responsive 320/768/desktop, themes, targeted contrast and fixture states have recorded evidence. Manual screen-reader, real-device, enlarged-text/zoom and complete WCAG 2.2 AA assessment remain pending. New attribution links receive focused review; this is not a conformance claim. |
| Browser persistence | Anonymous session access has no account recovery. Unsaved drafts, source place names absent from storage, inspection selection and selected absolute time are not persisted through full reload. Completed inputs restore with coordinate labels. Creation has no backend idempotency key. |
| Packaging | MapLibre's lazy ~1.05 MB minified engine advisory and third-party Zod annotation notices are nonfatal. No blanket performance claim or repeated benchmark suite. Production API docs disabled; use local OpenAPI for inspection. |

See DEPLOYMENT.md for release/rollback steps, PROVIDER_SETUP.md for actual usage controls and LIVE_API_CHECKLIST.md for narrowly bounded future checks. No pending item authorizes provider calls, publication or deployment.
