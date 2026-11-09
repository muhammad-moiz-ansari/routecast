# RouteCast Loom walkthrough - 9 minutes 30 seconds

This walkthrough is mapped to the two-page company brief, Weather-Aware Routing Website.pdf. The brief requires a 5-10 minute Loom video and weights route/weather/risk/recommendation logic and UI/map/heatmap at 40% each. Demonstrate those before spending time on code or extras.

## Audit result and scope

All requested feature areas are implemented in the repository: React/Django, origin and destination search, departure and load inputs, up to three provider routes, 10/25/50-mile checkpoints, ETA-matched forecasts, weather/load classification, deterministic route ranking, route/checkpoint map inspection, and a 0-48-hour corridor slider. This is source-level coverage, not fresh verification of the hosted deployment.

Important qualifications:

- TomTom is asked for two alternatives plus the primary route. It may return fewer than three distinct usable routes. Demonstrate a known three-route example rather than promising three everywhere.
- Rank eligible routes by Severe miles, High miles, distance-weighted average risk, then travel time. Time is the final criterion; there is no arbitrary risk/time weighted sum.
- At overlapping rain/snow boundaries, the code uses the higher category, with exact 1 in/hour rain and exact 3 in/hour snow remaining Severe. No Travel for those two variables is strictly greater than the upper limit. Load comparisons use strictly greater than 30,000/40,000 lb.
- Missing or stale weather cannot establish current eligibility. A previous assessment may remain inspectable while the current recommendation is withheld.
- The corridor view explores a selected forecast time. Route recommendations use each checkpoint's estimated arrival time; moving the slider does not recalculate the trip's departure or recommendation.
- Saving and listing bookmarks do not fetch provider data. Opening a saved active trip retains the existing heartbeat/periodic scheduling policy. Session expiry or clearing cookies loses anonymous access.
- The Git remote is configured, and the user has reported a Vercel/Render deployment. Repository access, latest hosted release, worker health and reviewer access still need a normal presenter check. A repository remote alone does not prove all current changes are published.
- The palette refresh build passed. Its existing focused UI suite had 37 passes and one stale heatmap test that expects the retired GeoJSON corridor-field source; current rendering uses raster image sources. Do not claim an entirely passing current test suite or measured frame rate. Local browser-tool visual verification was blocked by a connection timeout.

## Before pressing Record

1. Open three groups of tabs: the hosted home/planner; an already prepared trip with route/checkpoint/weather/corridor results; and your repository/editor. Keep keys, environment files, provider dashboards and private infrastructure connection strings off screen.
2. Use a route you have already confirmed works. Lahore to Faisalabad is a simple form example; Karachi to Islamabad shows a longer corridor. These place pairs do not guarantee three alternatives or interesting weather. Select the actual provider dropdown suggestions. For a live presentation, choose a departure inside the current forecast horizon and a cargo load such as 42,000 lb, with 25-mile spacing.
3. Prepare a second trip/view with visibly different wind conditions if you already have one. Otherwise use the clearly labelled synthetic fixture for a short explanation of risk differences. Do not call synthetic weather live data.
4. Complete the current analysis shortly before recording, so its freshness is still valid when explaining the recommendation. If the screen says stale or withheld, describe that honestly; do not present a previous recommendation as current.
5. Have a completed trip ready in another tab. If a new analysis takes more than about 10-15 seconds during the video, switch to it and say you are showing an earlier completed run. Do not suggest it is the just-submitted result. Avoid repeated Compare/Refresh clicks.
6. Pre-open the code files listed below. Use readable editor text and browser zoom. Record in one consistent theme; briefly toggle the other theme once. Spend very little time scrolling the landing page.
7. For fully offline fallback: in a separate PowerShell session inside frontend, set VITE_USE_FIXTURES=true, clear VITE_MAP_STYLE_DAY and VITE_MAP_STYLE_NIGHT, then run npm run dev. Open /trips/preview-trip. Say that its coordinates, route responses and weather are synthetic. Known fixture scenarios include ?fixture=stale, partial, blocked and cooldown. No backend or provider account is required for that mode. Fixture bookmarks are in-memory and reset with page reload; production bookmarks persist in PostgreSQL.
8. Actual source implementations and architecture can be demonstrated without changing configuration or restarting a hosted service. Show the setting's NAME in code; never reveal its value.

## Timed recording script

### 0:00-0:30 | Problem and scope | 30 seconds

Show: the home page at the top, then point to Plan a Route.

Say: "This is RouteCast, a React and Django application for weather-aware truck route planning. A driver enters a journey, departure time and cargo load. We compare available routes using the weather the truck is expected to encounter at checkpoints, rather than showing only the weather at the starting point."

Keep this introduction short. Do not make a guaranteed safety or certified navigation claim.

### 0:30-1:00 | Product and visual design | 30 seconds

Show: hero illustration, one workflow section, light/dark toggle, then Plan a Route.

Say: "The interface separates trip entry, route comparison and detailed map inspection. Both themes share the same visual system, and the planner adapts to smaller screens. The landing animation is illustrative; the trip results use provider data."

One theme toggle is enough. Avoid an extended animation tour.

### 1:00-2:00 | Journey inputs | 60 seconds

Show: partial origin/destination searches and explicit dropdown selection; departure picker; timezone; cargo 42,000 lb; spacing options 10, 25 and 50 miles. Select 25, then Compare routes once.

Say: "Locations are geocoded through autocomplete; city names do not need to be preloaded into our database. Departure is interpreted in the selected timezone. Cargo load is in pounds and affects the wind rules. Checkpoint spacing can be 10, 25 or 50 miles. For this example I am using 25 miles and a 42,000-pound cargo load."

While processing: "The backend calculates routes, checkpoint arrival times, matching forecasts and the final assessment in stages."

Do not leave the recording waiting silently. Use the prepared completed trip if necessary, explicitly identifying it.

### 2:00-3:00 | Alternatives and recommendation | 60 seconds

Show: the actual route alternatives and the recommended badge, distance/time, Severe/High mileage and coverage. Select a different route for inspection.

Say: "The routing provider can return a primary route and up to two alternatives. Among routes with complete, fresh coverage and no No Travel condition, the ranking first prefers fewer Severe miles, then fewer High miles, then lower distance-weighted average risk, and finally shorter travel time. A quicker route does not win simply because it is quicker."

Then: "Recommended and selected are separate: I can inspect another route without changing the recommendation."

If all live routes are Low, say the conditions are similar. Use a clearly introduced synthetic example to demonstrate a more interesting tradeoff; do not manufacture a live ranking difference.

### 3:00-4:05 | Checkpoints, ETA and cargo rules | 65 seconds

Show: a map checkpoint and its details, local ETA, wind/rain/snow values, units, freshness and risk reasons. Open the expandable details smoothly.

Say: "Checkpoints are placed along the route geometry at the selected mileage intervals, including the endpoints. Their arrival times come from cumulative route timing where available, with a labelled proportional-distance fallback. Weather is matched to each arrival time."

Then: "Wind of at least 55 miles per hour is No Travel for any load. At 45 to below 55, cargo above 30,000 pounds also becomes No Travel. At 35 to below 45, cargo above 40,000 pounds becomes Severe. The final category keeps the highest applicable hazard."

Use a verified synthetic case if the chosen live trip does not contain those conditions. Explain that risk mileage is based on interval distance, not the number of checkpoint markers.

### 4:05-5:10 | Corridor forecast and smooth interaction | 65 seconds

Show: wind overlay; slider at hour 0, 12, 24 and 48; next/previous hour controls; rain/snow/risk layers; hide/show overlay; a small pan or zoom. Keep the legend visible for one example.

Say: "This overlay lets us explore the trip corridor over a 48-hour period. The hourly frames are loaded as a dataset, so dragging the slider changes the local view instead of requesting a new forecast for every movement. We render a smoothly blended field, use fixed colour scales, and keep missing coverage distinct from low weather values."

Then: "The slider is a separate time exploration tool. The route assessment still uses the estimated arrival time at every checkpoint."

If winds look unchanged locally: "The forecast is relatively uniform here; an unchanged colour does not mean the control is broken." Use an already prepared variable-weather example rather than starting many live analyses.

### 5:10-5:30 | Save Trip and My Trips | 20 seconds

Show: Save Trip, My Trips, then open a saved journey.

Say: "A trip can be bookmarked and reopened from My Trips. Inputs and completed results are stored in PostgreSQL, so listing and saving do not repeat the external route or forecast requests. Ownership is tied to the browser's anonymous server-side session; this version does not have account-based synchronization or recovery."

Do not describe the feature as an authenticated user account.

### 5:30-5:50 | Missing data, freshness and controlled refresh | 20 seconds

Show: freshness/status, Refresh and Stop controls. Use a prepared stale/partial fixture if no natural failure state is available; avoid triggering live Refresh just for the recording.

Say: "Missing weather is never treated as zero. If a refresh fails or a result becomes stale, previous results remain inspectable, but current eligibility is withheld. External requests are protected by caching and provider usage limits. Refresh is explicit, and Stop prevents further work for that trip."

Qualify periodic reassessment: "Automatic reassessment is configuration-controlled and disabled in live-test mode."

### 5:50-7:55 | Architecture and provider replacement | 125 seconds

Use these bullets as narration notes. Focus on the visible structure and how it makes changes easier; avoid spending this section reading method signatures.

- Show the backend/services folder and its weather, routing, risk and recommendation modules.
  Say: "We used a Repository-Service structure to keep the backend modular. Each feature has its own module, so routing, weather and risk logic are organized separately instead of being mixed into one large file."

- Expand backend/services/weather and show weather_repo.py, weather_service.py and models.py.
  Say: "Each module follows a consistent structure. The repo file defines the contract, the service implements the workflow, and the models define the data passed between components. That makes it easier to find the right place for a change and understand how the pieces fit together."

- Briefly show backend/api/routes and backend/persistence/stores.
  Say: "API routes handle incoming requests, services handle application logic, and persistence stores handle database queries. Keeping these responsibilities separate makes the code easier to maintain and extend."

- Show the Open-Meteo and Pirate Weather adapter folders under backend/integrations, then get_forecast_source() in backend/api/dependencies.py.
  Say: "A practical example is our weather-provider change. Both adapters convert their provider's data into the same internal format. We can select the required adapter here while keeping the frontend, checkpoint calculation and risk-ranking logic consistent. This keeps provider-specific changes localized."

- Point back to the service constructor and module folders.
  Say: "The same separation helps with testing. We can pass in a fake provider and test the application logic without live API calls. Overall, the structure improves modularity, makes changes easier to manage and helps us add features with fewer changes across the codebase."

Presenter accuracy: repo files here are abstract service contracts; database queries live in persistence stores. Provider selection is configuration-based, not automatic failover. Provider replacement still requires validating unit conversions, timestamps, errors and request limits. Do not describe it as a guaranteed one-line change.

### 7:55-8:35 | AI summarization and insights | 40 seconds

Show: the route planner's AI suggestions section for a completed analysis. Have a generated result ready; avoid waiting on a new AI request during recording. Point to the route summary, departure/arrival explanation, cargo/weather caution, and the generated timestamp and analysis version. Use the actual displayed values rather than memorizing a sample trip's numbers.

Say: "We also added AI-generated insights to make the assessment easier to understand. This panel summarizes the recommended route, journey timing and relevant cargo or weather cautions in plain language. Here it explains the route distance and duration, departure timing and the conditions relevant to this load."

Then point to the disclaimer: "AI summarizes a completed assessment; it does not calculate the risk categories or determine the ranking. Those come from our deterministic rules. We show when the summary was generated and which analysis version it describes, and make clear that AI-generated text may be wrong."

If briefly showing code, use backend/services/suggestion/suggestion_repo.py and suggestion_service.py: the same Repository-Service pattern also applies here. The service receives its AI client and caches suggestions by trip and analysis version. The AI result does not feed back into the risk or recommendation services. Do not imply generated prose is independently verified against every threshold or always current.

Presenter note about the supplied sample: at exactly 30,000 lb, wind from 45 to below 55 mph is not blocked by the load override, which requires cargo strictly greater than 30,000 lb. Wind of at least 55 mph is No Travel for every load. Avoid reading an ambiguous AI sentence such as "wind 45-55 mph would block" as the authoritative rule. Prefer a verified summary for the recording and use the deterministic risk-reason panel to explain thresholds.

### 8:35-9:00 | Correctness evidence and repository | 25 seconds

Show: backend/config/risk_rules.py, a short boundary-test example in backend/tests/test_phase4.py, the provider selection/normalization tests in backend/tests/test_pirate_weather.py, then repository README/docs.

Say: "The risk thresholds are centralized and versioned. Tests cover exact boundaries, cargo overrides, distance-based risk mileage and the recommendation priority order. Provider tests use offline responses to check normalized units, missing values and adapter selection without consuming live quotas. The repository also documents API contracts, architecture, attribution and deployment."

Use existing recorded successful results if available. Do not claim every current test passes: one older heatmap test needs updating to the current raster renderer. Do not run a full test suite while recording just to fill time.

### 9:00-9:30 | Close on the product | 30 seconds

Show: return to the completed route/map view, with the correct current/previous status visible.

Say: "RouteCast brings together multiple route options, arrival-time weather, cargo-aware risk rules and an interactive forecast corridor. The recommendation is explainable, and the architecture keeps provider integrations separate from the business rules. The hosted application and repository links are included with this walkthrough. Thank you."

Only say that links are included after actually adding them to the submission. If weather is unavailable, call it a provider/coverage limitation rather than implying the displayed forecast is complete.

## Submission and narration reminders

- Deliver all three items: reviewer-accessible GitHub repository, working hosted application URL and the recorded 5-10 minute Loom link. The Loom recording itself remains to be created by the presenter.
- Spend roughly five minutes on the core user flow, about two minutes on architecture, 40 seconds on AI insights and the rest on context, reliability and evidence. AI insights are an additional feature, not a replacement for the required deterministic assessment.
- A 9:30 recording leaves a 30-second buffer under the ten-minute limit. If time runs long, cut Save Trip/AI detail and landing-page scrolling before cutting ETA matching, risk rules, ranking or the slider.
- Avoid claims of certified safety, guaranteed three routes, perfect forecast coverage, continuous sensor data, zero provider cost, automatic provider failover or a fully green current test suite.

Prepared from a read-only code/brief comparison. No live provider requests, deployments, staging or commits were performed for this review.
