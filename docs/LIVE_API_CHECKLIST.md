# Missing live and hosted evidence

Read VERIFICATION_LOG.md before every check. Reuse successful evidence; adding credentials, a phase change, a commit or a visual edit is not a reason to repeat it. No calls are authorized by this document. Phase 10 actual provider request budget/use: zero.

| Pending check | Why offline evidence is insufficient | Maximum initial live ceiling, only after reason/budget announcement |
| --- | --- | --- |
| TomTom geocoding | Actual account credentials, coverage and response contract | One explicit search, no retries |
| TomTom routing/guidance | Actual truck alternatives and maneuver timing availability | One routing request, no retries |
| Open-Meteo contract | Actual endpoint response metadata/coverage | One request with <=5 locations, no retries |
| Hosted basemap | Licensed style/tile/sprite/glyph delivery, attribution and key restrictions | State a separate bounded asset budget before opening a configured map; no default allowance |

These ceilings apply only to specifically missing evidence. Existing valid provider evidence, if later recorded, must not be repeated without a relevant contract/configuration change. Use isolated adapters and synthetic/non-private locations: submitting a full trip with real workers can exceed this weather ceiling through checkpoint/corridor work. Leave workers/Beat stopped for isolated contract checks. Do not fall back through multiple providers or probe repeatedly after rejected credentials/rate limits.

Other pending evidence does not require provider calls: production image build, Nginx syntax, Linux Gunicorn/worker commands, host TLS/Host/CSRF, backup/restore rehearsal and a broker→worker→snapshot smoke with isolated fake providers. Do not label in-process fake dispatch or SQLite as real broker/PostgreSQL evidence. A real runtime smoke must declare precisely which processes/data/providers it can touch before starting queues. No unannounced scheduled jobs or corridor-wide live fetch.

Manual accessibility remainder: screen-reader/device and enlarged-text/zoom review. Existing responsive/theme/keyboard/missing-state checks and contrast evidence remain reusable. Record result, source/configuration fingerprint, actual request/location counts and retest trigger. Mark unexecuted checks pending, never pass them by assumption.
