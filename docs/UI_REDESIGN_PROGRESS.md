# UI redesign progress

Updated 9 November 2026. This is the separate UI project; original implementation phases 0–10 remain complete.

| Phase | Status | Scope |
| --- | --- | --- |
| UI-1 | Complete | Branded landing, shared theme/tokens/font, explicit routes, lazy planner and controlled illustrative motion |
| UI-2 | Not started | Planner workspace, form/cards/map layout and responsive controls |
| UI-3 | Not started | Smooth operational corridor weather renderer and final presentation review |

## UI-1 result

Added the complete landing at `/`: original SVG route/weather scene, factual capability strip, selectable three-step workflow, authored 0/12/24-hour forecast illustration, real ranking explanation and methodology, five FAQ disclosures, closing planner CTA and footer notices. Illustrations are explicitly labeled; no invented operational readings or tracking claims. Heading font Manrope and its OFL licence are self-hosted.

Shared `ThemeProvider` preserves `routecast-theme`, follows system preference before explicit selection and provides a 48px sun/moon toggle with accessible labels and hover/focus tooltip. Blue/teal day/night tokens apply across the app. Explicit `/plan` and `/trips/:id` routes retain the existing planner behavior; unknown paths show recovery links. The planner is lazy-loaded and the landing imports no operational query/map hooks.

Motion uses CSS plus one-shot IntersectionObserver section reveals. The hero's shared paused state covers user pause, hidden document, offscreen scene and reduced motion; listeners/observers/animations clean up on unmount. Mobile weather regions remain static. Reduced motion retains the authored scene. No animation framework or backend changes were introduced.

The requested docs handoff did not exist initially. The user-supplied `../UI_REDESIGN_HANDOFF.md` was read and copied unchanged into `docs/UI_REDESIGN_HANDOFF.md` so later phases have the requested repository reference.

## Verification and limits

See UI1 entries in VERIFICATION_LOG.md. Four new focused component cases and three affected existing cases pass across scoped runs. Final production build passes TypeScript, 71 package notices and bundling. Actual fixture browser review covered desktop day/night, narrow 320px mobile, paused illustration, workflow/hour/disclosure controls, planner validation, keyboard place selection, successful trip navigation with retained values and the existing geometry-only trip map in both themes. Text/action/control token contrast checks pass. Routing/weather/basemap requests: **zero**.

Backend/risk/corridor/lifecycle evidence from phases 7–10 is reused. Planner core layout and its existing sticky-action behavior remain for UI-2; operational weather remains the existing polygon-cell implementation until UI-3. Full screen-reader/device/zoom review and OS-level reduced-motion browser review remain pending; the reduced-motion branch and cleanup are component-tested and its CSS is reviewed. Existing Zod annotation and MapLibre chunk-size advisories remain nonfatal. Existing release gates in PROGRESS.md are unchanged.

Owned fixture preview was stopped; the pre-existing server on port 5173 was left alone. Browser cleanup navigation timed out after the successful review, so final theme restoration/viewport reset is unconfirmed. No Git mutation, PR, publication or deployment. Stopped after UI-1; wait for the user's next phase instruction.
