# UI redesign progress

Updated 9 November 2026. This is the separate UI project; original implementation phases 0–10 remain complete.

## UI-1 interaction refinements — 9 November 2026

Completed the user's follow-up without starting UI-2/UI-3. Added a shared hover/focus baseline for enabled buttons and distinct hover/arrow feedback on workflow selectors and links. Suitable landing capability, workflow and forecast cards use reusable CSS foil and bounded pointer tilt, inspired by the React Bits Holo Card reference; no shader/package or idle animation was added. SS-4 was not attached, so the scope assumption is recorded in [interaction guidelines](UI_INTERACTION_GUIDELINES.md).

Replaced the repeated workflow label/line with three concrete authored examples: trip inputs, checkpoint arrival forecasts with cargo-aware Severe example, and eligible/blocked/incomplete route comparisons. Replaced the sliding forecast background with three geographically fixed wind fields that crossfade, with distinct readings, hour descriptions and a fixed scale. Mobile readings are real text rather than tiny SVG labels. These remain labeled illustrations, isolated from operational forecast/risk logic.

FAQ uses reusable AnimatedDisclosure with smooth opening **and closing**, rotating right/down chevron, native buttons, aria-expanded/controls and inert collapsed answers. Section anchors now scroll smoothly with instant reduced-motion navigation. User preferences are persisted in UI_INTERACTION_GUIDELINES.md and linked near the top of the handoff for future phase consistency.

Six targeted checks pass (four new cases plus two affected landing/motion cases). Actual fixture browser review confirmed the three workflow states, changed forecast fields/readings, hover foil/tilt, FAQ keyboard open/close and computed transition/chevron states, smooth anchor navigation, and 320px day/night readability without horizontal overflow. Final TypeScript/build/notices results and cleanup are recorded in VERIFICATION_LOG.md. No live routing/weather/basemap calls. Existing UI-1/backend evidence reused; screen-reader/device/OS reduced-motion coverage remains limited as recorded below. No Git or deployment actions.

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
