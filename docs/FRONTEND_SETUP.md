# Frontend setup — Phase 7

React/TypeScript/Vite planner, React Router, TanStack Query, React Hook Form/Zod, Temporal polyfill for IANA/DST handling, Radix Dialog and Lucide. Dependencies are bounded in frontend/package.json and resolved exactly in package-lock.json. Node 24/npm 12 were used locally; use a Vite-supported recent Node version. No map/animation/global-state/chart dependencies are installed before their phase.

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

Analysis status is read every 15 seconds while visible and processing, with focus refetch/retries disabled and obsolete requests cancelled. Complete/failed/stopped/cancelled/superseded status ends polling. This is Phase 7 processing feedback, not Phase 9's full refresh/heartbeat/version-synchronized frontend lifecycle. Direct trip URLs show status; drafts are not restored after a full page reload. Only theme preference is persisted. No route results, map, checkpoint inspection or corridor timeline is implemented in Phase 7.

Visual review used only fixtures at 320px mobile, 768px tablet and desktop (including 1440px), in day/night themes. Keyboard selection, error focus, Radix Escape/focus restoration and submission guards were checked. Targeted text/action/control contrast checks passed; this does not establish full WCAG compliance. Screen-reader/device testing, enlarged-text/manual zoom and complete later-phase states remain further review work. No external reference screen review is claimed. Temporary preview was stopped after review.
