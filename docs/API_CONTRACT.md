# API contract — Phase 0

Base prefix: `/api/v1/`. These are the only implemented operations:

| Method | Path | Response |
| --- | --- | --- |
| GET | /health/ | 200 `{"status":"ok"}`; no dependency I/O |
| GET | /ready/ | 200 when both probes pass; otherwise 503 |

Readiness body: `{"status":"ready" or "unavailable","database":boolean,"cache":boolean}`. It checks PostgreSQL and Redis, never external providers, and does not reveal exception details. These operational endpoints are intentionally unauthenticated and do not accept trip data.

OpenAPI: `/api/v1/openapi.json`. Interactive docs: `/api/v1/docs`. Domain routes, owner sessions on trip operations, standardized domain errors and data contracts are reserved for their requested phases; they are not implemented endpoints yet.
