# RouteCast — Professional UI Redesign Handoff

Prepared: 9 November 2026. Scope: design and implementation instructions, not completed UI changes.

## 1. Read this first

The original implementation phases 0–10 are complete. This is a new, three-phase UI project: **UI-1, UI-2, UI-3**. Do not restart the backend implementation plan.

Build a distinctive, credible weather-aware truck routing product for a company presentation. Provide an expressive animated landing page and a separate focused route-planning workspace. Use blue as the primary identity, teal as a restrained secondary accent, and a genuine sun/moon theme toggle. Replace the visible corridor boxes with smooth geographic weather gradients.

This document supersedes earlier frontend design guidance where it conflicts with these new visual requirements. Existing risk rules, API contracts, owner-session access, data provenance, refresh scheduling, and provider limits remain authoritative.

Execute **only the explicitly requested UI phase**. At the end, update the UI progress/verification records, summarize changes, suggest the commit message, and STOP. The user reviews and commits manually. Do not stage, commit, push, create PRs, publish, or deploy.

## 2. Evidence and repository baseline

The following were inspected before preparing this plan:

- The three user-supplied competition references, using rendered browser screenshots and page structure.
- Windy's rendered map, layered forecast colors, timeline, and weather controls.
- Mapbox Navigation's rendered dark hero, blue CTA, and large navigation product illustration.
- Current repository progress: implementation phases 0–10 complete; remaining release gates documented.
- Current frontend package setup: React 19, TypeScript, Vite, React Router, TanStack Query, Radix Dialog, Lucide, and MapLibre already exist. Reuse the installed stack.
- `frontend/src/app/router.tsx`: currently has a broad `/:mode?/:id?` route pointing at `App`.
- `frontend/src/app/App.tsx`: currently owns the planner, theme preference, trip submission, and analysis lifecycle together.
- `frontend/src/features/map/components/RouteMap.tsx`: owns the MapLibre instance and existing routes/checkpoints/corridor field.
- `frontend/src/features/map/utils/corridorField.ts`: currently generates disjoint cells, assigns the nearest sample, and produces polygon colors. This creates the visible boxes; changing CSS alone will not solve it.
- `frontend/src/features/weather-timeline/frame.ts`: contains layer names, missing masks, category colors, thresholds, and alignment utilities.
- Existing lifecycle, fixture isolation, stale data, session access, and attribution behaviors must survive the redesign.

Earlier local browser review showed a full-height planner at `/` and a synthetic route preview at `/trips/preview-trip`. That review is historical evidence, not a claim of a fresh screenshot in this planning pass. Inspect the current local UI at implementation time in fixture mode.

Do not inspect `.env` values or print credentials. Read example files only when necessary.

## 3. Reference board: what to take and what to avoid

These are visual references, not permission to copy their assets, copywriting, brand, or source code. The user's description of competition winners is context; award status was not independently verified.

| Reference | Observed design | RouteCast adaptation |
| --- | --- | --- |
| [Baton](https://nascon26-webdev.vercel.app/) | White canvas, generous spacing, oversized centered heading with italic emphasis, focused blue CTA, product demonstration panel, Capture/Escalate/Collect story | Clear hierarchy, concise promise, a route-specific animated product illustration and three-step explanation |
| [Endpaper](https://endpage-nascon.vercel.app/) | Strong yellow identity, enormous type, distinctive editorial/product preview, highly specific visual metaphor | Commit to a recognizable blue identity and a route-map metaphor; use disciplined large type, not its newspaper styling or yellow identity |
| [Walls Don't Lie](https://walls-dont-lie.vercel.app/) | Pink-framed page, floating white navigation, dimensional house/objects, evidence demonstration, numbered feature narrative | Restrained depth in one hero route scene and a visual sequence that explains the product; avoid importing its 3D engine or floating decorative objects |
| [Windy](https://www.windy.com/) | Map dominates, smooth scalar forecast fields, fixed legends, time bar and weather layer choices | Continuous weather overlay, quiet anchored controls and time exploration; omit dense global weather controls and wind particles from this scope |
| [Mapbox Navigation](https://www.mapbox.com/navigation) | Dark presentation, white typography, saturated blue CTA, large map/navigation product visual | Strong dark mode, readable blue route lines, product-first presentation and map prominence; no Mapbox SDK/provider migration |

The final design should be recognizably RouteCast: a moving route through forecast conditions. Do not combine unrelated reference effects into a collage.

## 4. Design concept: a clear route through changing weather

### Identity

- Brand: RouteCast, retaining its current recognizable route-symbol logo unless a small refinement is needed.
- Personality: confident, modern, precise, approachable.
- Primary motif: one blue route passing through soft forecast bands, with clear checkpoint markers.
- Supporting motifs: contour lines, restrained map coordinates/grid, small directional arrows and weather symbols.
- Hero depth comes from overlapping map layers and a slim product summary panel, not a generic 3D globe.
- Use genuine product explanations instead of invented trust metrics, customer logos, testimonials, uptime claims, savings, or safety guarantees.

### Visual hierarchy

1. RouteCast and one clear page purpose.
2. One primary action.
3. The map/product demonstration.
4. Decision-relevant detail.
5. Methodology and supporting explanation.

Landing: expressive composition, generous space, controlled motion.
Planner: compact hierarchy, readable controls, restrained motion, actual data.

No stock truck photograph is required. Prefer original lightweight vector/map artwork. Do not use remote stock imagery merely to fill a hero.

## 5. Palette and design tokens

### Day theme

| Role | Value | Application |
| --- | --- | --- |
| Brand blue | `#2563EB` | Primary actions, brand accents, selected route |
| Blue hover | `#1D4ED8` | Hover/active CTA |
| Blue deep | `#173FA6` | Strong accents, selected text |
| Blue tint | `#EAF1FF` | Selected rows and quiet panels |
| Canvas | `#F5F8FF` | Main page background |
| Surface | `#FFFFFF` | Form, floating panels, navigation |
| Secondary surface | `#EDF3FC` | Grouping and timeline regions |
| Main ink | `#10213A` | Headings and essential text |
| Secondary ink | `#52627A` | Supporting readable text |
| Neutral border | `#CFD9E8` | Nonessential separators |
| Control boundary | `#71829B` | Input boundaries where required |
| Teal | `#0F766E` | Secondary explanatory accents |
| Teal tint | `#E7F7F5` | Secondary panels |
| Sky | `#38BDF8` | Illustration accents; no small white text on sky |
| Focus | `#1D4ED8` | Clearly visible focus on light surfaces |

White text on blue `#2563EB` is the starting primary-button pairing. Verify actual states including disabled, hover, and keyboard focus. Decorative pale borders do not substitute for sufficient input boundaries.

### Night theme

| Role | Value | Application |
| --- | --- | --- |
| Canvas | `#091321` | Deep navy background |
| Surface | `#111F33` | Panels/navigation |
| Raised surface | `#1A2C46` | Popovers and selected groups |
| Main ink | `#F3F7FF` | Main text |
| Secondary ink | `#B6C5DA` | Supporting text |
| Neutral border | `#334864` | Nonessential dividers |
| Control boundary | `#8197B6` | Important control edges |
| Primary | `#85B2FF` | Action backgrounds and selected affordances |
| On primary | `#0B1B35` | Text on light blue buttons |
| Primary hover | `#A2C5FF` | Hover/active |
| Teal accent | `#5EEAD4` | Small secondary accents |
| Focus | `#B4D0FF` | High visibility focus |

Preserve the existing `data-theme="day"/"night"` contract and theme preference key. Do not use CSS inversion. A night map must use the configured night style rather than a filtered day map.

### Risk colors and semantics

Preserve existing shared category semantics across badges, map, legend and mileage strips. Centralize colors instead of keeping divergent definitions in several components.

| Risk | Day foreground | Day background | Identifier |
| --- | --- | --- | --- |
| Low | `#166534` | `#ECFDF3` | Check + Low |
| Moderate | `#854D0E` | `#FEF9C3` | Caution + Moderate |
| High | `#9A3412` | `#FFF0E5` | Warning + High |
| Severe | `#B91C1C` | `#FEF2F2` | Strong warning + Severe |
| No Travel | `#6B21A8` | `#F3E8FF` | Stop symbol + No Travel |
| Unknown | `#475569` | `#EEF2F6` | Dashed/question + Unavailable |

No Travel purple retains the current map distinction from Severe red; it is a semantic exception, not a purple brand theme. Define legible explicit night badge pairs. Do not use color alone or reinterpret risk rules through the palette.

### Typography and rhythm

- Headings: locally hosted Manrope variable, limited weights, with a robust system fallback. Use the same family for the brand if appropriate.
- Body/UI: existing system stack or locally hosted Inter; choose one body family, not multiple decorative fonts.
- Limit font files/weights and provide `font-display: swap`; no repeated external font requests.
- Landing H1: `clamp(2.6rem, 5.3vw, 5.4rem)`, tight but readable line height, about 11–14 words maximum.
- Landing H2: approximately 36–48 px desktop, 28–34 px mobile.
- Planner page heading: 24–28 px; section headings 18–20 px.
- Body: 16 px; key form labels 15–16 px; supporting metadata normally 14 px.
- Tabular numerals for durations, distances, load, forecast values and timestamps.
- Spacing: 4/8 px scale; landing sections 80–112 px desktop and 48–64 px mobile.
- Radii: 10 px controls, 16 px panels, 24 px hero visual. Pills reserved for status chips and navigation CTA when justified.
- Shadows: one subtle panel shadow and one focused overlay shadow. No glow around every element.

## 6. Information architecture and routing

Replace the catch-all planner route with explicit pages:

| Path | Page | Purpose |
| --- | --- | --- |
| `/` | Landing | Explain the value and direct the visitor to planning |
| `/plan` | Planner workspace, empty | Enter a trip and compare routes |
| `/trips/:id` | Planner workspace, existing trip | Inspect a real owner-scoped trip |
| `/trips/preview-trip` | Existing development preview | Retain current fixture-only behavior and isolation |
| Unmatched paths | Not-found page | Clear return to home/planner |

Use `/plan` for the main CTA and route creation must continue navigating to `/trips/{id}`. Preserve any genuinely used legacy paths through explicit redirects after checking current tests and links; do not keep an ambiguous wildcard that treats arbitrary paths as trips.

Preview must remain excluded from the production fixture path as current code requires. Do not expose development fixtures to make a public demo work.

Landing can include a self-contained original illustrative scene in production, clearly captioned **“Illustrative route preview”**. This scene has no backend connection, no synthetic operational trip, no fabricated live timestamps, and no provider request.

Load the planner/map chunk lazily. Landing must not mount `useTripLifecycle`, query a trip, import runtime fixtures, or initialize MapLibre. Share the theme and navigation without sharing planner side effects.

## 7. Landing page — detailed composition

### 7.1 Navigation

- Maximum content width 1240–1280 px, centered; desktop gutters 40–56 px, mobile 20 px.
- Header about 72 px tall; brand left, `How it works`, `Weather insight`, `Methodology` center, theme toggle and `Plan a route` right.
- Slim opaque or nearly opaque surface; subtle bottom boundary after scrolling. Avoid large animated backdrop blur.
- On mobile: brand, theme toggle, menu button. Menu includes the primary CTA; keyboard accessible and properly dismissed.
- Anchor links use real section IDs and scroll margins. Native scrolling; no scroll hijacking or mandatory Lenis dependency.

### 7.2 Hero: signature route scene

Desktop: asymmetric split, roughly 44% copy and 56% illustration. The map scene may extend slightly beyond the content column while remaining within viewport bounds. At 1280×800 the headline, CTA and most of the visual must be visible.

Suggested copy:

- Eyebrow: `WEATHER-AWARE TRUCK ROUTING`
- H1: **Know the weather. Choose your route.**
- Body: `Compare truck routes using forecast conditions at your estimated arrival times, cargo load and travel time.`
- Primary CTA: `Plan a route` with a small arrow, links to `/plan`.
- Secondary CTA: `See how it works`, scrolls to the explanation.
- Small factual line: `10 / 25 / 50 mile checkpoints · 48-hour corridor forecast`.

Illustration specification:

1. Original muted map-like vector background: a few arterial roads, river curve, contour shapes and small region labels. It is a schematic, not a copied map screenshot or geographically precise route.
2. Three paths; one solid primary blue route and two quieter alternatives. A/B/C markers and checkpoints make the product immediately recognizable.
3. Two soft localized forecast regions, e.g. blue/teal field and amber weather patch, behind route lines.
4. A small truck/directional marker follows the blue route slowly. It must be described as an illustration, not a tracked driver.
5. One anchored white/navy summary card: `Weather at arrival` and a short explanation such as `Forecasts matched to checkpoint ETAs`. Avoid invented time-saved or risk scores.
6. Tiny illustrated sun/cloud symbols, no unrelated floating spheres or giant truck model.
7. A visible pause/resume illustration control with an accessible label.

Use SVG/CSS and, only if useful, scoped Anime.js. A static, already legible scene appears before animations initialize.

### 7.3 Product capability strip

Four concise factual items separated by fine rules, not fake business KPIs:

- Up to 3 route options.
- Arrival-time weather checks.
- Cargo-aware risk rules.
- 0–48 hour forecast exploration.

Use `up to` honestly. Do not display a partner-logo ticker or invented fleet/customer counts.

### 7.4 How it works: three steps and one visual

Left: numbered accessible buttons/tabs; right: one changing schematic view.

1. **Set your trip** — locations, departure and cargo.
2. **See conditions ahead** — checkpoints highlight along the route with forecast time labels.
3. **Compare your options** — route summary highlights the reasoning order.

No automatic tab carousel. User click/keyboard updates the view with a 200–300 ms fade/short transform. All essential explanatory text remains available to assistive technology. Mobile uses stacked sections or an accessible tab group, without sticky scroll traps.

### 7.5 Weather insight section

Full-width quiet-blue section with copy on one side and a smooth corridor visual on the other. Suggested heading: **The forecast, along your journey.**

- Explain weather-at-arrival versus viewing the corridor at a chosen hour.
- A small illustrative hour control can change between three authored views, without loading the actual planner or all 49 frames.
- Caption `Illustrative forecast`; do not show “Live” or a current fetched timestamp.
- One continuous gradient region, readable routes and a fixed legend preview. Avoid the original cell-grid appearance.

### 7.6 Recommendation explanation

Use a strong type-led section with a compact comparison illustration. Heading: **A recommendation you can explain.**

Show the real decision order: fewer Severe miles → fewer High miles → lower average risk → shorter travel time, after excluding No Travel/incomplete routes according to implemented eligibility rules.

Use a 2×2 arrangement or vertical numbered list, not four widely spaced tiny cards. Link `View methodology` to a readable dialog/section with actual rules and limitations.

### 7.7 FAQ, closing CTA and footer

Use 4–5 short accordion questions:

- Does RouteCast always return three routes?
- Is corridor forecast time the same as checkpoint arrival time?
- How does cargo load affect risk?
- What happens when forecast data is missing?
- Is this live vehicle tracking? Answer accurately: the implemented planner does not track GPS movement.

Closing band: strong blue surface with readable contrasting text, `Plan with a clearer view ahead.` and `Open route planner` CTA. No lead-capture form or fake signup workflow.

Footer: RouteCast, Planner, How it works, Methodology, existing required acknowledgements/license link where applicable. No invented social accounts, privacy promises, company clients or empty dead links.

## 8. Motion specification and efficient implementation

| Element | Motion | Timing | Rule |
| --- | --- | --- | --- |
| Hero copy | Opacity + translateY 10–16 px | 450–600 ms, small stagger | Once, visible immediately with reduced motion |
| Hero route | SVG stroke reveal | 1000–1400 ms | Once; no permanently redrawing long paths |
| Truck marker | Slow path travel with dwell | About 14–18 seconds per cycle | At most one loop, user-pausable, offscreen/hidden paused |
| Weather region | Small group translate/opacity variation | About 12–18 seconds | Reuse fixed SVG shapes; no animated blur radius |
| Sections | Gentle opacity/translateY | 350–500 ms | IntersectionObserver, once; never hide content if JS fails |
| Feature view | Short fade/slide | 200–300 ms | On intentional selection |
| Theme icon | Sun/moon crossfade/rotation | 150–200 ms | No full-page circular reveal |
| Controls | Background/border/2 px arrow movement | 120–180 ms | Mouse, touch and keyboard states equally clear |
| Planner | State transitions only | 120–180 ms | No decorative perpetual motion |

Implementation requirements:

- CSS transitions for ordinary UI; optional **one** scoped Anime.js hero timeline. Do not add Framer Motion, GSAP, Three.js and Anime.js together.
- User-supplied [Anime.js](https://animejs.com/) and [React Bits](https://reactbits.dev/) are toolboxes, not required dependencies. If a React Bits reveal is selected, copy only the necessary source and adapt reduced motion. Do not import a large animated background library for one effect.
- Use [shadcn/ui](https://ui.shadcn.com/) selectively for accessible Dialog, Accordion, Tabs, Tooltip, Sheet or Slider patterns; keep existing Radix behavior and styles where adequate. No wholesale styling-framework migration just to use a component.
- `prefers-reduced-motion` renders a static scene and disables autoplay. Also provide pause because reduced-motion preference alone does not cover all users.
- Coordinate all hero motion under one playing/paused state. Pause on document hidden, scene out of view, route change and user pause. Cleanup observers/timelines on unmount, including Strict Mode remounts.
- No React setState every animation frame. Use SVG/DOM refs or the animation engine.
- Do not animate layout properties, huge filters, full-screen blur, or hundreds of particles. No background videos or required WebGL on landing.
- Keep first content and CTAs readable without a preloader. No intro gate, fake loading sequence or scroll lock.
- Mobile: static weather regions plus a simpler route animation, or entirely static under reduced motion. No hover-only essential behavior.
- Do not run an extended performance benchmarking campaign. Implement these constraints and visually check for obvious stutter, layout shifts or expensive work; investigate further only if an actual issue appears.

## 9. Planner workspace — redesign

### 9.1 Desktop frame

Use a compact 64 px application header and a workspace filling the remaining viewport (`100dvh` with fallback). Avoid stacking all results above the map.

- Header left: RouteCast logo links home, small `Route planner` context.
- Header right: sun/moon toggle, `Methodology`, and a small mode/status area where relevant.
- Left panel: approximately 360–400 px wide, independent vertical scrolling. Two clear states: initial trip form; results with compact editable trip summary and route cards.
- Main region: persistent large map, minimum practical height around 480 px on desktop, with fit-to-routes control and a small right-side vertical control rail.
- Bottom inside map workspace: docked forecast timeline, reserved height around 110–150 px, outside map label/attribution areas. Do not let it cover checkpoint controls.
- Checkpoint details: one focused popover or right drawer, with close/escape and focus return.
- Accessible checkpoint list: a dedicated `Checkpoint list` panel/tab; avoid appending a huge always-expanded table beneath the primary map. Keep it fully accessible and reachable through a skip link.

At typical 1366×768, route choices and map should be visible together. The form's main CTA must not float over and hide input rows as in the earlier view.

### 9.2 Trip entry

- Title `Plan your route`, concise explanatory sentence.
- Origin/destination form fields share a visual journey rail, with recognizable location and destination icons.
- Swap button located between/alongside fields, not a separate oversized row.
- Departure date and time clearly labeled. Timezone visible as a button/chip opening an accessible searchable choice; preserve real IANA handling. Initially show system timezone; support explicit override.
- Cargo load field clearly marked `lb`. Do not combine cargo with gross truck weight.
- Spacing as a three-option segmented radio group: 10 mi / 25 mi / 50 mi.
- Main CTA: `Compare routes`; text processing stages inline when submitted.
- Keep clear field-level errors, error summary and focus handling. No multi-step wizard for this short form.

### 9.3 Results panel

Top: origin → destination; departure, load and spacing in concise secondary line; `Edit trip` action.

Next: recommendation summary with a blue marker and one actual reason. Example structure: `Route B recommended` / reason supplied by backend. Important No Travel/Unknown remains prominent.

Route cards:

- Row 1: route identity badge A/B/C, route name and recommendation label if applicable.
- Row 2: large duration, distance, estimated arrival timestamp with timezone nearby.
- Row 3: Severe miles and High miles; compact shared risk-distribution strip with accessible text equivalent.
- Row 4: explicit selection/inspection action and concise eligibility state.
- Selected route: blue border + tinted surface + readable selected text, not just a check color.
- Recommended and selected remain separate states. Changes to recommendation must not silently change inspection selection.
- Blocked route remains inspectable; no normal eligible-selection claim. Unknown coverage is not Low.

Do not repeat a long ETA caveat and full fetch timestamp after every card. Use concise per-card status and one nearby details disclosure for shared technical metadata. Critical stale/blocked/incomplete state must remain visible without opening a disclosure.

### 9.4 Map treatment

- Selected route in saturated blue with a contrasting casing; alternatives in distinguishable teal/slate/violet tones if needed. Preserve A/B/C labels and explicit selection.
- Use soft day base map colors and a deep navy night base map; only use already configured licensed styles. Do not invent a basemap API integration or spend tiles during fixture checks.
- Routes and hazard markers remain above weather colors. Labels/attribution remain readable.
- Circle checkpoint markers with adequate halos/hit targets; selected point larger with focus ring, not square label sprites everywhere.
- Origin and destination labels distinct from checkpoint labels.
- Maintain camera during refresh and theme changes; preserve selected route and point. Call map.resize on panel layout changes. No repeated map recreation on each frame.
- Right rail: zoom, fit routes, legend access. Do not add GPS/recenter controls implying unimplemented vehicle tracking.
- Show `Basemap not configured` or a usable text alternative if necessary. Do not hide map failures behind endless loading.

### 9.5 Timeline and layers

- Main dock row: selected forecast date/time, timezone and previous/next buttons.
- Clear 0–48 hour slider with hour/day tick labels, thumb target at least 44–48 px via hit area.
- Layer segmented control: Wind / Rain / Snow / Risk, collapsing to accessible select on narrow widths.
- Fixed gradient legend with numeric labels and units, plus categorical explanation for Risk.
- Overlay show/hide action; optional opacity control behind settings only if genuinely useful.
- Caption `Corridor forecast at selected time` and nearby help explaining that route recommendation uses checkpoint arrival forecasts. Avoid a paragraph competing with the timeline.
- Missing/stale coverage: visible concise label + details disclosure. Keep original dataset/source attribution and sample-value alternative.
- Preserve existing frameIndex/alignment logic, timestamps and update lifecycle. Slider must make **zero** provider calls.

### 9.6 Tablet/mobile

- Around 1024 px: collapsible planner panel, not three simultaneously squeezed columns.
- Below about 768 px: map stage and bottom sheet with explicit accessible detents/buttons, plus clearly named `Trip`, `Routes`, `Checkpoints` navigation. Dragging is optional, never the only way to expand.
- Initial planning can be full-screen form; once submitted transition to map + results sheet.
- Timeline moves into a compact accessible dock that does not collide with sheet or safe-area inset. A `Forecast` button can expand details.
- Minimum 320 px reflow for non-map content, 200% text enlargement and visible focus.
- Preserve form values and selected absolute forecast time on responsive layout changes. No separate mobile data fetching pipeline.

## 10. Sun/moon toggle

Replace the Day/Night/System select in the primary header with a single 44–48 px icon button.

- In day mode, show Moon with accessible name `Switch to dark mode`.
- In night mode, show Sun with accessible name `Switch to light mode`.
- Use a real button; icon is aria-hidden, tooltip appears on keyboard focus and hover.
- First visit follows system preference; user toggle creates explicit persistent preference using the existing key. Offer `Use system setting` in a secondary appearance menu only if needed, not a third state in the main toggle.
- Existing stored `system`, `day` and `night` preferences continue to resolve correctly.
- Apply theme early enough to avoid a flash; respect existing CSP/deployment constraints when choosing bootstrap code. Avoid an unrestricted inline script workaround.
- Theme is global across landing and planner. Extract current App-owned theme effect into one provider/hook instead of implementing two competing systems.
- Use correct surface/chart/map colors and retain map view/selection after a theme style reload.

## 11. Smooth weather field — implement the data, not a blur trick

### 11.1 Problem

The current `corridorCells`/`fieldFeatures` implementation selects one sample for each square polygon and maps values to flat category colors. Making borders transparent or applying CSS blur to the whole map would still yield inaccurate block patterns and blurry labels.

Replace the operational weather polygons with a georeferenced scalar image/raster field. Keep actual sample values, masks, rules, dataset versions and checkpoint assessments unchanged.

### 11.2 Preferred bounded solution

Use MapLibre image/canvas source support with a raster layer. Choose a static image source updated only when the frame changes, or a CanvasSource with `animate: false` and explicit updates; verify behavior against the installed MapLibre version. Do not introduce a permanently running render loop for a static forecast frame.

Create a frontend worker for field sampling when work would otherwise block input. Start with bounded viewport/corridor chunks, roughly 256–512 pixels per side and a hard maximum output pixel budget. Initial target maximum: about one million pixels across all active chunks. These are implementation limits, not measured performance promises.

Pipeline:

1. Normalize sample coordinates and route geometries using existing antimeridian-aware utilities where valid. Preserve high-latitude limitations explicitly.
2. Build a reusable geographic support/mask representation and sample-neighbor lookup per dataset/geometry revision.
3. Use a local metric projection for neighbor distances, with correct geographic/geodesic fallback for long routes. Align raster pixels with MapLibre's supported Mercator image georeferencing; do not stretch an arbitrary lat/lon canvas over a large area.
4. Split large/disconnected corridors into bounded chunks; do not allocate one enormous image covering an ocean or wraparound world extent.
5. For each supported pixel, interpolate actual wind/rain/snow scalar values from nearby **valid** forecast samples.
6. Use normalized inverse-distance weights as a simple starting policy, e.g. `w = 1 / max(distance, epsilon)^2`, bounded to 3–6 nearby samples. Exact sample coordinate must recover that sample value.
7. Bound support radius using actual sample spacing. Do not fill all space merely because one valid sample exists far away. Document the radius rule selected after checking current grid layout.
8. Apply missing-data exclusion and corridor mask before color assignment; unsupported areas are transparent or covered by a separately labeled sparse unknown pattern.
9. Convert the interpolated scalar value through a fixed continuous color ramp for that variable. Clamp outside display range with explicit endpoint labels; never renormalize per hour/view.
10. Publish image updates with job IDs; discard old worker results after rapid slider movement, dataset replacement or component unmount.
11. Draw the weather layer below routes, checkpoints and readable labels. Cache small recent-frame images, e.g. selected ±1 and an LRU of at most six frame/layer outputs, not every pixel frame indefinitely.

### 11.3 Missing data and geographic boundaries

- Do not bridge a missing-data gap simply by normalizing the remaining distant neighbors.
- Retain a separate coverage mask informed by the original sample layout: if the containing/nearest support region is missing for that frame/layer, leave it unknown. Require bounded valid local support rather than silently painting through absent regions.
- Interpolation must not cross disconnected corridor components or a narrow geographic gap between unrelated route branches without support.
- Clip to the **union** of route corridors, not intersections and not the whole map. Overlapping routes share the field; their weather must not add intensity.
- Feather transparency only inside the corridor edge; alpha remains zero outside. Do not let blur bleed through the mask or remove unknown holes.
- On dateline crossings, split image chunks; preserve supported high-latitude text-only fallbacks instead of showing distorted or fabricated fields.
- Additional rendering pixels are interpolation, not additional forecast samples. Keep spatial resolution and uncertainty accessible.

### 11.4 Continuous layers versus categorical risk

Wind/rain/snow are continuous fields: interpolate values before assigning colors. Example wind ramp may pass through blue → teal → amber → orange → rose with labeled mph stops, using existing threshold values as meaningful anchors. Rain/snow need variable-specific legends with correct units; zero precipitation should have little or no overlay, not a saturated hazard color.

Combined risk is categorical and must not be averaged as numeric ordinal colors to imply lower risk. Use a conservative local category policy (e.g. maximum category among supported near neighbors) and a smooth geographic alpha edge, with exact category colors and visible Severe/No Travel markers. If a blurred/crossfaded display is used cosmetically, it must preserve identifiable hazardous cores and is not an interpolated risk score. Unknown remains unknown.

Route line risk and recommendation still come from backend checkpoint/interval assessments. Do not classify raster interpolation back into authoritative checkpoint risks. Label combined display `Illustrative corridor risk` or equivalent explanation when derived visual interpolation is involved.

### 11.5 Interaction and fallbacks

- Scrubbing schedules only the latest necessary field render; backend/provider requests stay at zero.
- Keep previous frame only with `Updating forecast view` while new work finishes, then show the new timestamp with its image atomically. Never label an old image with a new time.
- Do not crossfade across missing/No Travel masks in a way that temporarily portrays a known hazard as safe. Prefer immediate updates for categorical Risk.
- If raster generation fails, retain routes, legend and sample/checkpoint tables; show an explicit overlay-unavailable message.
- Keep current source/license credits and fixture mode's no-tile/no-glyph/no-provider network behavior.
- Clean up workers, Blob URLs, image sources, event handlers and frame caches.

### 11.6 Focused offline checks

One small set of meaningful deterministic checks for this newly changed rendering behavior:

- Exact sample recovers value; normalized interpolation stays within neighbor scalar range.
- Overlapping corridors do not amplify values.
- Missing region remains masked, including when valid neighbors surround it.
- Pixels outside corridor have zero alpha.
- Fixed value has the same legend color across hours.
- Severe/No Travel categorical support is not averaged down.
- Dateline chunk bounds do not span nearly the entire world.
- Old worker result cannot overwrite a newer frame.
- Slider does not create provider requests.

Reuse existing rules/ranking/lifecycle verification; no backend live retest is needed for this display-only change.

## 12. Accessibility and content density

- Target WCAG 2.2 AA; verify actual pairings rather than claiming compliance from token choices.
- Body text 4.5:1, large text 3:1, essential non-text/control contrast 3:1 where applicable.
- Buttons and touch targets generally 44–48 px, visible focus, no hover-only essential detail.
- Landing automatic motion that runs beyond five seconds has a working pause/stop control. Reduced-motion support is additional.
- One descriptive H1 per page, semantic landmarks and working skip links.
- Accessible tabs/dialogs/sheets retain logical focus and Escape behavior.
- Textual route/checkpoint/sample alternatives remain available when map or WebGL fails.
- Use concise summaries with expandable detail for rules, fetch times and interpolation metadata. Do not force drivers to read a paragraph of developer detail in every card.
- Keep No Travel, incomplete/stale forecast, important ETA assumptions and source attribution clear. Progressive disclosure must not hide a critical state.
- Announce meaningful completion/failure, not every forecast frame and poll.
- No autoplay sound, flashing, cursor-following essential content, hidden scrollbars or forced animated scrolling.
- Plan/review while stopped; do not imply active driving interaction or live GPS tracking.

## 13. Suggested component/file changes

Adapt this to the actual repository rather than mechanically creating empty files:

```text
frontend/src/
  app/
    router.tsx                 # explicit /, /plan, /trips/:id routes
    App.tsx                    # slim shared app responsibilities after extraction
    ThemeProvider.tsx
  pages/
    LandingPage.tsx
    PlannerPage.tsx
    NotFoundPage.tsx
  components/
    layout/
      SiteHeader.tsx
      PlannerHeader.tsx
      SiteFooter.tsx
    ui/
      ThemeToggle.tsx
      WeatherAttribution.tsx   # preserve existing behavior
  features/
    landing/
      components/
        HeroSection.tsx
        HeroRouteScene.tsx
        HowItWorks.tsx
        WeatherInsight.tsx
        RecommendationStory.tsx
        LandingFAQ.tsx
      illustration.ts          # authored schematic geometry, not runtime fixtures
    trip-planner/
      components/
        TripForm.tsx
        TripSummary.tsx
        PlannerSidebar.tsx
      hooks/useTripLifecycle.ts # reuse existing hook
    route-comparison/
      components/              # restyle existing cards/details; avoid parallel copies
    map/
      components/RouteMap.tsx
      rendering/
        fieldInterpolation.ts
        fieldMask.ts
        fieldPalette.ts
        fieldRenderer.ts
        field.worker.ts
        fieldCache.ts
      utils/                   # retain suitable existing geographic helpers
    weather-timeline/
      components/ForecastTimeline.tsx
      frame.ts                 # preserve alignment and missing-data contracts
  hooks/
    useReducedMotion.ts
    useSceneActivity.ts
  styles/
    tokens.css
    globals.css
    landing.css
    planner.css
```

Keep the existing API client/contracts, backend architecture, mutations, lifecycle/stop rules and session/CSRF behavior. Do not introduce separate duplicate contracts for the redesigned views.

If a small presentational extraction changes module locations, update affected imports and tests without deleting historical evidence. Update package/attribution notices if new fonts or libraries are added.

## 14. Three implementation phases

### UI-1 — Shared design system and animated landing

**Goal:** a finished, distinctive landing page with reliable routing to the existing planner.

Work:

1. Read current instructions, progress, verification log and this document. Record UI work separately from completed phases 0–10.
2. Extract a shared theme provider and implement sun/moon toggle, preserving existing preferences.
3. Add explicit landing/planner/trip/not-found routes. Move current planner behavior to `/plan` and retain trip paths, without redesigning its core layout yet.
4. Implement day/night tokens, typography, shared header/footer and navigation.
5. Build the complete landing sections, original SVG route scene, limited animations, pause and reduced-motion behavior.
6. Lazy-load planner/map; confirm visiting `/` does not mount trip queries or initialize MapLibre.
7. Update setup/source notices only as needed for actual additions.

Acceptance:

- Landing looks complete at 1440, 1280 and narrow mobile widths, in both themes.
- No generic placeholder hero, invented statistics, dead CTA or fixture content presented as live.
- Hero route scene is visible with disabled motion and can be paused.
- `/plan` and existing trip preview still work; form submission retains existing navigation behavior.
- Shared theme persists across navigation without competing effects.
- Existing backend and provider checks are reused, not rerun.

Verification: scoped TypeScript/build checks after final edits, relevant router/theme component checks and a short actual browser review in fixture mode. No live routing/weather/tile calls. No broad benchmark suite.

Suggested commit: `feat: add branded landing page and shared theme controls`

Update `docs/UI_REDESIGN_PROGRESS.md` and relevant verification records, summarize and **STOP**.

### UI-2 — Professional planner workspace

**Goal:** coherent desktop/mobile route planning with map and choices visible together.

Work:

1. Extract presentational form/summary/sidebar components from App while preserving lifecycle and validation.
2. Build full-viewport desktop layout with scrollable sidebar, dominant map, nonoverlapping timeline area and detail drawer.
3. Restyle form, time/timezone controls, spacing and route cards according to this document.
4. Improve map route/point styling, anchored control rail, camera preservation and layout resize behavior.
5. Add concise metadata disclosure, complete status/error/empty views and an accessible checkpoint-list mode.
6. Implement responsive mobile sheet/navigation with explicit buttons and preserved form state.
7. Keep old corridor field functional until UI-3; do not label it finished smooth rendering yet.

Acceptance:

- At 1366×768 and 1280×800, results and map are simultaneously useful.
- Form actions do not cover fields; map controls, attribution and timeline do not collide.
- Route selection, recommendation, blocked/unknown states and retained stale analysis remain correct.
- Keyboard can plan a trip, inspect a route and checkpoint, move forecast time and close dialogs.
- 320 px layout and enlarged text remain usable; map has a textual alternative.
- Theme switch/refresh does not reset camera, selection or create requests.

Verification: affected frontend integration/interaction checks only, fixture browser review for desktop/mobile and both themes. Reuse already verified provider/risk logic; no live API calls.

Suggested commit: `feat: redesign route planner and map workspace`

Update records, summarize and **STOP**.

### UI-3 — Smooth weather rendering and final visual review

**Goal:** replace operational grid boxes with smooth scalar fields and finish the presentation experience.

Work:

1. Implement bounded geographic scalar raster/worker pipeline and coverage masks from section 11.
2. Integrate image/canvas source lifecycle, latest-frame cancellation, fixed legends and bounded caches.
3. Preserve distinct categorical-risk treatment, unknown holes and hazardous markers.
4. Finish timeline/layer control layout, caption/legend consistency and frame/timestamp synchronization.
5. Remove or clearly retire the superseded polygon weather layer; do not draw both fields simultaneously.
6. Review landing-to-planner transitions, day/night colors, loading/error/partial states and mobile overlays.
7. Update current methodology UI copy explaining interpolation; preserve actual source attribution and known data limitations.
8. Review motion cleanup and static/reduced-motion fallback.

Acceptance:

- Wind/rain/snow fields appear as smooth gradients at ordinary zoom; no visible nearest-neighbor squares.
- Missing regions stay distinguishable; colors never escape corridor bounds or hide known hazards.
- Overlap does not add intensity; values use fixed unit legends.
- Slider changes remain local; an old raster never receives a new timestamp label.
- No unbounded frame storage, continuous static canvas loop, broken theme style reload or detached worker.
- All core textual information remains usable if overlay or map fails.
- Both landing and planner look consistent and complete in the final browser review.

Verification: small new interpolation/mask/cancellation checks listed above; relevant frontend build and interaction checks; actual fixture browser review. No repeated provider smoke tests or performance-measurement campaign.

Suggested commit: `feat: render smooth corridor forecasts and polish the interface`

Update records, summarize and **STOP**. Do not infer deployment authorization.

## 15. Verification discipline and review matrix

Read `docs/VERIFICATION_LOG.md` before running checks. Maintain UI-specific evidence with tested behavior, relevant code changes, result, date and request count. Run only checks justified by new changes or unresolved failures.

Use the project's documented fixture workflow. No credential inspection, live-provider sweeps, repeated identical tests or automated browser navigation that secretly loads live basemap tiles. Do not mount operational provider hooks on landing. Reference browsing and normal dependency setup are separate from provider usage and must not be reported as route/weather calls.

Review a compact representative matrix, not every possible permutation:

| View | Minimum coverage |
| --- | --- |
| Landing | Day/night desktop; narrow mobile; paused/reduced motion |
| Empty planner | Desktop/mobile; validation and keyboard order |
| Complete preview | Routes + map + timeline, both themes |
| Hazard/partial | No Travel, Unknown, stale data, missing overlay region |
| Accessibility | Keyboard, focus return, text reflow, non-map alternative |
| Geographic rendering | Supported fixture geometry, overlap, missing data and dateline logic |

Screenshots used as development evidence should be captured at stable states. Do not claim actual visual review from code inspection alone. Reuse valid previous evidence when unchanged.

## 16. Completion report template

After each phase:

1. Completed UI phase and resulting user-visible behavior.
2. Key files changed.
3. Relevant checks run and existing evidence reused.
4. Actual route/weather/basemap requests made, ideally zero.
5. Remaining limitations or unresolved review items.
6. Suggested conventional commit message.
7. `Stopped after UI-N. Waiting for your next phase instruction.`

Do not say complete while a required acceptance condition is failing. Do not make the manual commit for the user.

## 17. Copy-ready initial Codex prompt

```text
Read docs/UI_REDESIGN_HANDOFF.md fully, applicable repository instructions,
docs/PROGRESS.md and docs/VERIFICATION_LOG.md.

Implement UI-1 only. Original phases 0–10 are already complete.
Follow the specified landing design, palette, sun/moon toggle, animation
controls and routing separation. Preserve the existing backend, API contracts,
fixture isolation and planner lifecycle.

Use existing components where suitable. Do not call routing, weather or map-tile
providers during UI verification. Use the documented fixture workflow and
reuse existing verification; run only new or affected checks.

Do not stage, commit, push, create PRs, publish or deploy.
Update UI progress and verification records, summarize the changes and checks,
suggest the commit message and STOP. Wait for me to request UI-2.
```

Continuation: replace UI-1 with UI-2 or UI-3 and read `docs/UI_REDESIGN_PROGRESS.md` as well. The user reviews/commits each completed phase manually.

## 18. Technical/source references for implementation

Visual references reviewed on 9 November 2026:

- [Baton](https://nascon26-webdev.vercel.app/)
- [Endpaper](https://endpage-nascon.vercel.app/)
- [Walls Don't Lie](https://walls-dont-lie.vercel.app/)
- [Windy](https://www.windy.com/)
- [Mapbox Navigation](https://www.mapbox.com/navigation)

Tools/documentation, consulted as relevant rather than mandatory additions:

- [Anime.js](https://animejs.com/) — scoped timelines, SVG paths and scroll-triggered effects; verify current API before using examples.
- [React Bits](https://reactbits.dev/) — selectively adapt source for a reveal/microinteraction; do not import unrelated animated backgrounds.
- [shadcn/ui](https://ui.shadcn.com/) — accessible component foundations customized to RouteCast.
- [MapLibre CanvasSource](https://maplibre.org/maplibre-gl-js/docs/API/classes/CanvasSource/) — canvas-backed geographic rendering; check the installed version's update/animation behavior.
- [MapLibre ImageSource](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/) — geographic image updates for bounded forecast fields.
- [WCAG pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) — automatic moving content and user control.
- [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/) — accessibility implementation checks.

The raster interpolation policy, layout dimensions, palette, copy suggestions and motion budget are RouteCast design proposals. They are not claims made by reference websites. Do not infer that visual polish certifies weather accuracy, safety, commercial readiness or competition results.
