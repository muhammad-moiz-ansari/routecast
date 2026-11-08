# Weather/load rules — 2026-11-08.v1

Configuration is versioned in backend/config/risk_rules.py. Values are assessed before display rounding. Wind is sustained 10 m wind, rain is normalized liquid rain plus showers, snow is snowfall depth rate, and cargo is pounds (not gross vehicle weight).

| Category | Wind mph | Rain in/hour | Snow in/hour |
| --- | --- | --- | --- |
| Low | <25 | <0.10 | <0.5 |
| Moderate | >=25 and <35 | >=0.10 and <0.25 | >=0.5 and <1 |
| High | >=35 and <45 | >=0.25 and <0.50 | >=1 and <2 |
| Severe | >=45 and <55 | >=0.50 and <=1 | >=2 and <=3 |
| No Travel | >=55 | >1 | >3 |

The higher category applies at overlapping lower boundaries. Exact 1 in/hour rain and 3 in/hour snow remain Severe, since No Travel is strictly greater. Wind >=55 is No Travel for every cargo load.

Cargo overrides are strictly greater: wind >=45 and <55 with cargo >30,000 lb is No Travel; wind >=35 and <45 with cargo >40,000 lb is Severe. Exactly 30,000/40,000 lb does not satisfy its corresponding override. Final risk is the maximum known weather category and applicable load override. Reasons include code, observed normalized value, threshold, units, cargo where relevant, and plain explanation.

Missing data is never numeric zero. A checkpoint lacking required coverage is incomplete; known Moderate/High/Severe/No Travel hazards remain visible, but otherwise its category is Unknown. Weather for a different checkpoint arrival instant is not used. Duplicate/invalid/nonfinite/negative weather is rejected. Version-mismatched weather is treated as unavailable. Freshness remains separate from category: stale Low is ineligible, not a current Low assessment.

For each actual checkpoint interval use the higher endpoint category. Preserve known hazards when an endpoint is unknown, and mark that interval's coverage incomplete. The approximation is conservative at sampled endpoints; it is not evidence of conditions everywhere on the road. Category mileage sums to the provider route distance; checkpoints are not counted as miles. `unassessed_miles` is a separate overlapping coverage measure and must not be added to `miles_by_category`. An incomplete interval may carry known Severe mileage and also count as unassessed.

Eligibility requires complete coverage at every checkpoint, fresh data, and no No Travel condition. Eligibility reasons are independent of ranking. Only eligible routes receive an average: sum(interval miles × category score)/total miles, where Low=0, Moderate=1, High=2, Severe=3. Unknown and No Travel have no average-risk score; ineligible routes return null rather than zero.

Rank eligible routes lexicographically by unrounded Severe miles, High miles, distance-weighted average risk, travel time, stable route ID. Never combine risk and time using arbitrary weights. Explanations identify the first metric separating the winner from the next eligible route (or the single-eligible-route condition). A slower route wins when it has fewer Severe miles.

Result states: RECOMMENDED, NO_ELIGIBLE_ROUTE (all blocked/no routes or failed routing without results), INCOMPLETE_DATA (no eligible route because coverage/freshness is insufficient), PENDING (routing has not completed). Fully assessed eligible routes may be compared while another route is unavailable; a notice explicitly limits that comparison. All alternatives remain inspectable. Recommendation never writes a selected route.

Phase 4 introduced deterministic assessment. Phase 5 now persists the captured route/checkpoint/forecast/risk result together and reads completed snapshots, with current staleness overlays. The result carries route analysis and rules versions; it is not a certified navigation or safety guarantee. Previous provider, sampling, forecast coverage and freshness limitations still apply.
