# Decisions

- 2026-11-08: Phase 0 only; Python 3.12, Django 5.2 LTS, Ninja and Pydantic 2. Bounded direct dependencies and uv.lock resolve exact versions. No frontend lockfile until its phase.
- Health is a small concrete service demonstrating the required repo/service/model convention, without fake domain methods.
- PostgreSQL 17 and Redis 7 local containers bind to loopback. Image tags are explicit; deployment hardening is deferred.
- SQLite is solely offline test infrastructure. It is not a runtime replacement for PostgreSQL.
- Celery entry point is `config.celery:app`; no package-level auto-import, task scheduling or provider requests.
- Root .env configures Compose; backend/.env configures Django. Existing environment variables take precedence. Align database credentials manually; examples never include provider keys.
- User prohibits staging/committing; lockfiles are generated and left unstaged despite the plan's wording about committing them.
