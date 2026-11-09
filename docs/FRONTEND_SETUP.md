# Frontend setup — Phases 7–9

UI-2: `/plan` now has a viewport workspace with an independently scrollable trip/route sidebar, persistent map, docked forecast controls and checkpoint list/drawer. At narrow widths use Trip, Routes, Checkpoints and Map, plus explicit panel detents; very short viewports use a full text panel or Map view. Forecast details contains sampling/source metadata and the sample-value alternative. The Timezone chip opens a searchable IANA chooser; Escape cancels unconfirmed input. Edit trip preserves loaded values for a new comparison. Fixture verification still uses the same development-only flag and needs no backend/providers. The operational weather-cell renderer remains until UI-3.

UI-1 adds the landing page at `/`, the existing planner at `/plan`, retained `/trips/:id` links and a real not-found page. Shared day/night controls preserve `routecast-theme` and follow the system before a user choice. Manrope headings are self-hosted with `/fonts/OFL.txt`; no remote font service or animation dependency is required. Landing illustrations are authored examples and mount no operational query/map hooks. See UI_REDESIGN_PROGRESS.md for this separate UI project; the planner workspace redesign and smooth operational forecast renderer are later phases.

React/TypeScript/Vite planner, React Router, TanStack Query, React Hook Form/Zod, Temporal polyfill for IANA/DST handling, Radix Dialog and Lucide. Dependencies are bounded in frontend/package.json and resolved exactly in package-lock.json. Node 24/npm 12 were used locally; use a Vite-supported recent Node version. MapLibre GL JS is added in Phase 8; no animation/global-state/chart packages are introduced.

From frontend:

```powershell
npm ci
npm run dev
```

The dev server binds to 127.0.0.1, normally port 5173. For normal backend operation start Django at 127.0.0.1:8000 and the backend's required infrastructure/workers separately using the existing README. Vite proxies /api with the original Host preserved, so browser Origin/Host agree for Django CSRF checks. Cookies are same-origin and the CSRF token is obtained from /session/. No permissive CORS or CSRF exemption is added. The proxy requires no backend CORS or CSRF exemption.

For provider-free UI review, start the explicitly synthetic development mode instead:

```powershell
$env:VITE_USE_FIXTURES='true'
npm run dev
```

This mode dynamically serves development fixtures for session/search/create/status and shows a persistent synthetic-data banner. It never contacts the backend/providers and cannot be built with production mode enabled. The fixture module is removed from the normal production bundle. Clear the variable before building or using the backend (`Remove-Item Env:VITE_USE_FIXTURES` in that shell). No real environment/credential file was created or overwritten. frontend/.env.example documents the optional flag; provider secrets must never be browser environment variables.

```powershell
npm run build
npm test
```

Read VERIFICATION_LOG.md before repeating checks. Tests replace fetch and reject unexpected endpoints; no provider checks are needed for frontend changes. In the Codex Windows sandbox only, Vitest needed a workspace temp directory because OS temp rename was denied: set TEMP/TMP to frontend/.test-tmp (ignored), then use `node node_modules/vitest/vitest.mjs run` with a targeted -t filter. Normal user environments can use npm test. npm 12 argument forwarding was unreliable for dev flags here; direct `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173` also works.

Planner behavior: visible location labels; debounce, cancellation and explicit keyboard/mouse selection; swap; local departure plus editable IANA zone; finite nonnegative cargo; 10/25/50-mile radio group. Temporal rejects skipped/repeated DST wall times instead of shifting departure. The backend remains authoritative for forecast horizon and all weather/risk/ranking calculations.

Trip POST happens only on valid explicit submission, never in an effect or automatic retry. A synchronous guard plus submitted-state lock prevents duplicate rapid clicks/StrictMode submissions. Values remain visible and locked after creation until Plan another trip is chosen. Failed submissions preserve values and focus the error summary. Network ambiguity is not solved by an idempotency key: backend creation still lacks that feature, so users should verify connectivity before resubmission.

Analysis status is read every 15 seconds while visible and processing, with focus refetch/retries disabled and obsolete requests cancelled. Stopped trips end polling; completed active trips continue low-frequency status reads to discover server-scheduled reassessment. Errors suspend interval reads until explicit retry or renewed page activity. Phase 9 extends this to continuous visible active-trip status discovery, owner heartbeats and explicit refresh/stop controls. Direct URLs restore inputs from a completed snapshot, using coordinate labels because place names are not stored. Unsaved drafts are not persisted or restored. Theme and layer/overlay display preferences are persisted. Phase 8 adds route comparison, MapLibre geometry and checkpoint inspection. Phase 9 adds the cached corridor timeline and refresh lifecycle described below.

Visual review used only fixtures at 320px mobile, 768px tablet and desktop (including 1440px), in day/night themes. Keyboard selection, error focus, Radix Escape/focus restoration and submission guards were checked. Targeted text/action/control contrast checks passed; this does not establish full WCAG compliance. Screen-reader/device testing, enlarged-text/manual zoom and complete later-phase states remain further review work. No external reference screen review is claimed. Temporary preview was stopped after review.


## Phase 8 map and comparison

The comparison consumes the frozen AnalysisProjection.data payload (inputs/routes/checkpoints/weather/recommendation) and its outer freshness/revision flags. Risk, mileage, eligibility and ranking stay backend-authoritative. Inspection selection is independent of recommendation, is retained on updates, and is explained if its ID disappears. No Travel alternatives stay inspectable. Old/stale/revised/offline assessments withhold current recommendation claims without discarding their text. Initial working routes can render from the read-only /routes/ endpoint while weather is pending; no forecast request is triggered by inspection.

MapLibre is lazy-loaded with its own engine chunk. Configure both VITE_MAP_STYLE_DAY and VITE_MAP_STYLE_NIGHT in frontend/.env.local to licensed MapLibre style JSON URLs (including self-hosted free/open-data styles). These are public browser URLs: use only explicitly public, origin-restricted map keys. Never add TomTom routing/geocoding or weather secrets to VITE variables. Confirm the chosen provider's license, traffic allowance and required source attribution before enabling tiles. Style sources must include the provider's attribution; MapLibre's visible attribution control renders it. Routing/weather attribution is also visible in the legend.

No paid/free-tier provider is automatically chosen or contacted. Without both URLs, a labeled geometry-only map renders routes/checkpoints on a theme-aware background; this is not a geographic street basemap. Fixture mode always forces this local style even when URLs exist. Actual hosted style, tile, glyph and sprite requests have not been verified. A failed map keeps route rows, recommendation explanation, risk miles and checkpoint table usable. The map is not a navigation system.

Map features preserve GeoJSON longitude/latitude order, initial fit only (or explicit Fit routes), stable A/B/C identity colors and local bitmap labels, selected halo, unassessed/blocked dash treatments, selected-route checkpoint risk icons, zoom-level clustering and 48px checkpoint hit targets. Theme style reloads reuse existing sprites and preserve camera state. A ResizeObserver handles hidden mobile panels. Routes/Map mobile switches keep the form and selection mounted. Tables stack on narrow/tablet layouts; checkpoint dialogs support Escape, a visible close control and focus return.

Synthetic fixture preview: open /trips/preview-trip after enabling VITE_USE_FIXTURES. Optional ?fixture=partial, ?fixture=blocked and ?fixture=stale cover two-route, no-eligible and retained-data states. The stored comparison.json is generated by pure existing backend checkpoint/risk/ranking services. To regenerate without uv cache/network setup, from the repository root:

```powershell
$env:PYTHONPATH=(Resolve-Path backend).Path
backend/.venv/Scripts/python.exe frontend/src/test/fixtures/generate_comparison.py
```

Target new tests with `node node_modules/vitest/vitest.mjs run src/test/comparison.test.tsx src/test/comparison-app.test.tsx` only if related behavior changes; reuse P7/P8 evidence otherwise. The engine's approximately 1.05 MB minified lazy chunk emits Vite's >500k advisory; it does not load on the empty planner. No chunk-warning suppression or performance benchmark suite was added.


## Phase 9 timeline and lifecycle

No dependency installation or new environment values are required. Existing backend services must be running for real data. The fixture workflow remains provider-free: the 49-frame corridor JSON is generated using test settings and fake stores plus the real pure grid/classifier/read projection. Regenerate only after relevant contract/rules changes:

```powershell
$env:PYTHONPATH=(Resolve-Path backend).Path
backend/.venv/Scripts/python.exe frontend/src/test/fixtures/generate_corridor.py
```

Wind, rain, snow and combined-risk layers use fixed legends. Hour zero through 48, keyboard-native range behavior, previous/next and first-hour buttons expose timestamp plus timezone. Layer and overlay preferences persist locally; absolute selected time is held while the trip stays mounted and is preserved in a replacement dataset when in range (otherwise nearest boundary/frame). Time is derived directly on render to avoid a transient old frame index. No playback or autoplay is implemented; frame changes have no animated transitions, including under reduced motion. Checkpoint ETA forecasts and recommendations remain independent.

A bounded shared Mercator lattice draws disjoint nearest-sample scalar cells. A spherical point-to-polyline distance plus conservative cell radius clips every cell to the buffered route union. No additive heatmap or unrestricted convex-hull interpolation is used. Sparse sampling leaves gaps and does not imply actual meteorological resolution. Samples beyond 85 degrees latitude are omitted from this map overlay with a visible warning; accessible sample coordinates/values remain available. Scalar missing cells are gray with dashed boundaries; combined risk retains a known hazard but marks incomplete data. Toggle overlay off without changing route selection.

Analysis and corridor queries consume abort signals; hidden/offline pages cancel outstanding reads, working-route reads and heartbeat work. Heartbeats keep an explicitly viewed active owner trip eligible for backend scheduling; do not run normal-mode previews against real workers merely for UI review. Ready corridor arrays do not refetch for each poll/slider movement. Old completed route data stays mounted during refresh or failed status reads; failed reads withhold current recommendation claims and provide GET-only retry; a new version hides an old mismatched overlay until the matching dataset arrives. Status/corridor read retries are GET-only. Refresh/stop use CSRF, disable conflicting actions, honor cooldown, retain results and ignore obsolete mutation responses after navigation to another trip. A stopped trip cannot be resumed through these controls.

Development fixture refresh shows retained results, then publishes a new synthetic version on the next status read; its anchor advances one hour to demonstrate absolute-time preservation. Stop affects in-memory fixture state. Reload resets fixture server simulation, while display preferences persist. Optional ?fixture=cooldown returns a synthetic 429 Retry-After. These fixtures do not constitute a real broker/provider end-to-end smoke.

Relevant new tests: timeline.test.tsx, lifecycle.test.tsx, the corridor-map integration case in comparison.test.tsx, and backend/tests/test_phase9.py. Existing P7/P8 evidence is reused except for affected integration cases. Refer to VERIFICATION_LOG.md before rerunning tests. Live worker/provider/basemap evidence and manual screen-reader/device/enlarged-text review remain pending.

Per-frame values are outside live regions; the slider supplies the selected timestamp through aria-valuetext. Loading/failure feedback remains announced without announcing every drag or poll.
