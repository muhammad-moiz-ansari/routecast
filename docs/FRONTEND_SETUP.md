# Frontend setup — Phases 7–8

React/TypeScript/Vite planner, React Router, TanStack Query, React Hook Form/Zod, Temporal polyfill for IANA/DST handling, Radix Dialog and Lucide. Dependencies are bounded in frontend/package.json and resolved exactly in package-lock.json. Node 24/npm 12 were used locally; use a Vite-supported recent Node version. MapLibre GL JS is added in Phase 8; no animation/global-state/chart packages are introduced.

From frontend:

```powershell
npm ci
npm run dev
```

The dev server binds to 127.0.0.1, normally port 5173. For normal backend operation start Django at 127.0.0.1:8000 and the backend's required infrastructure/workers separately using the existing README. Vite proxies /api with the original Host preserved, so browser Origin/Host agree for Django CSRF checks. Cookies are same-origin and the CSRF token is obtained from /session/. No permissive CORS or CSRF exemption is added. Backend implementation/configuration is unchanged.

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

Analysis status is read every 15 seconds while visible and processing, with focus refetch/retries disabled and obsolete requests cancelled. Complete/failed/stopped/cancelled/superseded status ends polling. This is Phase 7 processing feedback, not Phase 9's full refresh/heartbeat/version-synchronized frontend lifecycle. Direct trip URLs show status; drafts are not restored after a full page reload. Only theme preference is persisted. Phase 8 adds route comparison, MapLibre geometry and checkpoint inspection. Corridor timeline/full refresh integration remain Phase 9.

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
