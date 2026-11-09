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
| UI-2 | Complete | Viewport planner, scrollable sidebar, docked forecast, checkpoint drawer/list and responsive navigation |
| UI-3 | Not started | Smooth operational corridor weather renderer and final presentation review |

## UI-2 result — 9 November 2026

Implemented only UI-2 plus the requested shared specular CTA refinement. Primary landing/header/menu/closing planner CTAs and the Compare routes action use SpecularAction: an original pointer-lit CSS rim inspired by the React Bits reference, with keyboard focus, disabled and static reduced-motion states. No WebGL/shader/animation dependency or idle loop was added. The preference is recorded in UI_INTERACTION_GUIDELINES.md.

The planner fills the viewport under a compact header. A separately scrollable sidebar holds the trip summary, edit action, refresh/stop controls, recommendation and compact route cards. The map stays alongside results; forecast controls occupy their own dock, and attribution remains outside controls. Shared timing/source metadata is disclosed once while stale, blocked, incomplete and proportional-ETA cues remain visible. Checkpoints have a dedicated text-list mode and a focused Radix drawer with Escape/focus return.

Extracted PlannerHeader, PlannerSidebar, TripForm, TripSummary, TimezonePicker, RouteCard and CheckpointList. App retains mutation, validation, restoration, session and lifecycle ownership. A stable sidebar portal keeps inspection and absolute forecast time with the mounted comparison/map. Theme, panel and responsive changes do not fit/recreate the map; its existing ResizeObserver handles layout. Selected lines are blue with casing, route labels are circular, selected endpoints are distinguished, and zoom/fit/legend controls occupy an anchored rail. Risk badge, strip, marker and existing categorical-field colors now share one palette, with explicit day/night badge pairs.

Mobile uses Trip/Routes/Checkpoints/Map navigation and explicit sheet expansion/collapse; its forecast dock can expand independently. Very short viewports prioritize a full text panel with a separate Map view. Editing preserves values and prepares a new comparison, leaving the saved trip intact. Searchable timezone choices preserve the existing IANA conversion/schema; Escape discards unconfirmed search text. Form submission remains explicit and guarded against duplicates; its CTA flows after fields instead of covering them.

Verification: 20 unique focused cases pass across scoped runs (18 affected existing cases, 2 new cancellation/panel-preservation cases); final TypeScript/production build and 71 notices pass. Actual fixture review covered 1366×768 and 1280×800 desktop, day/night results and 320px reflow, 640×400 constrained layout, form validation/submission, editing/timezone search, drawer and legend Escape/focus return, cached forecast time and pane controls. All 12 risk badge contrast pairs exceed 4.5:1. See UI2 entries in VERIFICATION_LOG.md for scope, fingerprints, resolved failures and review limits.

Routing/weather/basemap calls: zero. Backend, API contracts and lifecycle/risk rules are unchanged; prior verification is reused. Operational weather remains the existing cell renderer for UI-3. Actual browser text enlargement, screen-reader/device breadth and existing release gates remain pending; constrained CSS viewports were reviewed without claiming full WCAG certification. Owned preview stopped, viewport reset and original night preference restored. No staging, commit, push, PR or deployment. Stopped after UI-2; await the user's next phase request.

## UI-1 result

Added the complete landing at `/`: original SVG route/weather scene, factual capability strip, selectable three-step workflow, authored 0/12/24-hour forecast illustration, real ranking explanation and methodology, five FAQ disclosures, closing planner CTA and footer notices. Illustrations are explicitly labeled; no invented operational readings or tracking claims. Heading font Manrope and its OFL licence are self-hosted.

Shared `ThemeProvider` preserves `routecast-theme`, follows system preference before explicit selection and provides a 48px sun/moon toggle with accessible labels and hover/focus tooltip. Blue/teal day/night tokens apply across the app. Explicit `/plan` and `/trips/:id` routes retain the existing planner behavior; unknown paths show recovery links. The planner is lazy-loaded and the landing imports no operational query/map hooks.

Motion uses CSS plus one-shot IntersectionObserver section reveals. The hero's shared paused state covers user pause, hidden document, offscreen scene and reduced motion; listeners/observers/animations clean up on unmount. Mobile weather regions remain static. Reduced motion retains the authored scene. No animation framework or backend changes were introduced.

The requested docs handoff did not exist initially. The user-supplied `../UI_REDESIGN_HANDOFF.md` was read and copied unchanged into `docs/UI_REDESIGN_HANDOFF.md` so later phases have the requested repository reference.

## Verification and limits

See UI1 entries in VERIFICATION_LOG.md. Four new focused component cases and three affected existing cases pass across scoped runs. Final production build passes TypeScript, 71 package notices and bundling. Actual fixture browser review covered desktop day/night, narrow 320px mobile, paused illustration, workflow/hour/disclosure controls, planner validation, keyboard place selection, successful trip navigation with retained values and the existing geometry-only trip map in both themes. Text/action/control token contrast checks pass. Routing/weather/basemap requests: **zero**.

Backend/risk/corridor/lifecycle evidence from phases 7–10 is reused. Planner core layout and its existing sticky-action behavior remain for UI-2; operational weather remains the existing polygon-cell implementation until UI-3. Full screen-reader/device/zoom review and OS-level reduced-motion browser review remain pending; the reduced-motion branch and cleanup are component-tested and its CSS is reviewed. Existing Zod annotation and MapLibre chunk-size advisories remain nonfatal. Existing release gates in PROGRESS.md are unchanged.

Owned fixture preview was stopped; the pre-existing server on port 5173 was left alone. Browser cleanup navigation timed out after the successful review, so final theme restoration/viewport reset is unconfirmed. No Git mutation, PR, publication or deployment. Stopped after UI-1; wait for the user's next phase instruction.

## UI-2 correction in progress — 9 November 2026

User rejected the empty planner's density and mismatch with the landing. Revisited all three supplied references visually. Replaced the legacy width-constrained empty state with PlannerWelcome using the same extracted HeroRouteScene as home (static initially, with explicit motion control), matching Manrope/blue/teal identity, panel spacing and shared branding. Improved focused fields, segmented controls and card feedback; moved the collapse arrow into an animated header action. Removed the fixture test-values dialog and preview banner at the user's explicit request; synthetic content remains synthetic. Tests/build are being checked separately.

This follow-up is **not complete**. Automatic browser approval review rejected localhost navigation because account usage limits prevented the approval check. No workaround was attempted. Current rendered UI review is pending; earlier screenshots do not verify these changes. The newly requested smooth operational gradient field also remains unimplemented: existing polygons are still present. It must preserve geographic support, missing holes and categorical hazards under the UI-3 rendering requirements, rather than blurring existing boxes.

Fixture inputs: search/select Albany and Boston; future local departure (10 November 2026 13:00 for this recorded session), Asia/Karachi, 42,000 lb, 25 mi. Results are pre-authored and do not represent a live route between those names. No provider calls or Git/deployment actions.
