# Provider usage protection

Implemented 9 November 2026. These are application safety limits for one PostgreSQL database, shared by Django, core workers and corridor workers. They are independent of provider billing/account balances.

| Provider | Per UTC minute | Per UTC hour | Per UTC day | Per UTC calendar month |
| --- | ---: | ---: | ---: | ---: |
| TomTom search + routing combined | 20 requests | 100 requests | 100 requests | 2,000 requests |
| Open-Meteo | 200 units | 1,000 units | 4,000 units | 100,000 units |
| Groq (AI suggestions) | 5 requests | 30 requests | 100 requests | 2,000 requests |

Each forecast location reserves `ceil(requested days / 14) * ceil(hourly variable count / 10)` units. The current four-variable, 16-day forecast plus one past day costs two conservative units per location: a 50-location batch reserves 100, not one. This deliberately rounds up; it is not a provider invoice estimate. Core checkpoint batches and corridor batches share the same ledger. The older Redis telemetry remains acquisition-attempt/location accounting and does not define these limits.

The guard runs immediately before HTTP in both provider clients. PostgreSQL row locks serialize all windows in one committed reservation. Rejected reservations consume nothing; attempted requests are never refunded for timeout, authentication, rate limit or other provider failures. Cached reads and map slider/layer changes reserve nothing. Storage errors, missing migrations, invalid limits and backwards clock windows fail closed. Requests already in flight cannot be recalled. Fixed-window reset times are UTC, not the trip timezone.

Synchronous denials return HTTP 429, `provider_budget_exhausted` and Retry-After; unavailable protection returns sanitized 503. Background analyses show a readable quota/setup message, retain existing published results and do not automatically retry or schedule new reassessments after these errors. After reset or repair, retry manually. Corridor denial yields missing/partial coverage; it never invents calm conditions.

Groq is reserved one request per uncached `POST /trips/{id}/suggestions/`; cached results and all GETs reserve nothing. No migration is needed for it because the ledger has one row per provider name. App defaults sit well below Groq's free-plan limits for `openai/gpt-oss-20b` (30 requests/minute and 1,000/day when checked on 9 November 2026); confirm your account's actual limits in the Groq console.

GROQ_API_KEY is backend-only and optional; without it the suggestion box says AI suggestions are not set up and nothing is sent. GROQ_MODEL defaults to `openai/gpt-oss-20b`, a current Groq production model on 9 November 2026 (Llama 3.x models were shut down for free/developer keys on 16 August 2026); if requests fail with `ai_request_rejected`, check [Groq models](https://console.groq.com/docs/models) and [deprecations](https://console.groq.com/docs/deprecations). Each uncached request is one HTTPS POST to Groq's chat completions endpoint with strict JSON-schema output, low reasoning effort, 3-second connect/20-second other timeouts, no redirects or retries and sanitized errors. Requests carry route statistics, local times, checkpoint weather and cargo load, not coordinates or place names; review Groq's terms and data policy before using real trip data.

## Activate locally

Stop Django and both Celery workers with Ctrl+C. From `backend`:

```powershell
uv run --no-sync python manage.py migrate
uv run --no-sync python manage.py provider_usage
```

Restart Django and both workers with the normal commands from README. Keep Beat stopped and `ROUTECAST_LIVE_TEST_MODE=true` during development. Old worker processes must be restarted to load the new guard. This migration only creates a new quota table; it does not delete trip data or contact providers. If this environment cannot reach PostgreSQL, activation must be performed in the user's working terminal.

The read-only `provider_usage` command shows used/limit/remaining/reset time without keys, trip data or provider calls. There is intentionally no reset command. Counters begin when protection is installed; prior account usage is not imported. Never reset the ledger or restore an old database merely to bypass a limit.

## Configuration

Optional backend `.env`/production `.env.production` variables are `TOMTOM_LIMIT_MINUTE`, `TOMTOM_LIMIT_HOUR`, `TOMTOM_LIMIT_DAY`, `TOMTOM_LIMIT_MONTH`, and the equivalent `OPEN_METEO_LIMIT_*` and `GROQ_LIMIT_*` variables. Defaults above apply without adding entries. Zero blocks that provider/window; negatives and nonintegers fail settings initialization. All processes must use the same database, settings and trustworthy clock. Raising a limit does not reset usage, and changing credentials does not create a new allowance.

The [current TomTom pricing page](https://docs.tomtom.com/pricing) lists different monthly allowances per product, including 2,500 for this app's Search API and 20,000 for Routing; the app conservatively combines both under 2,000/month. [Open-Meteo pricing](https://open-meteo.com/en/pricing) lists free minute/hour/day/month limits and [terms](https://open-meteo.com/en/terms) restrict free endpoint use to noncommercial applications. Confirm the actual account terms and remaining allowance rather than treating app defaults as a promise of free usage.

Provider calls made by other applications/accounts/databases, browser basemap assets, historical usage before installation, database deletion/restore and account billing-period differences are outside this ledger. A global ceiling prevents unlimited app spending but is not per-owner/IP abuse protection: one user can exhaust the shared allowance. Keep provider dashboard controls and controlled ingress; this change alone does not establish readiness for unrestricted public release. PostgreSQL concurrent-lock behavior and hosted runtime remain pending live infrastructure verification; offline tests exercise SQLite transactions and mock HTTP only.
