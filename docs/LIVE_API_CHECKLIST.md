# Live API checklist

Phase 0: no external provider calls authorized or required. No credentials required.

Future phases: read VERIFICATION_LOG.md first, reuse successful evidence, state the new behavior and reason offline checks are insufficient, and bound requests/locations before any live check. Initial ceilings: one geocoding request if not previously verified, one routing request, one weather request with at most five locations; no automatic retries or background jobs. These ceilings do not authorize requests now.

Pending by design: TomTom geocoding/routing and Open-Meteo contracts. They are future-phase checks, not Phase 0 failures.
