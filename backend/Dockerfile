ARG PYTHON_IMAGE=python:3.12-slim-bookworm
FROM ghcr.io/astral-sh/uv:0.10.5 AS uv
FROM ${PYTHON_IMAGE}
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_PYTHON_DOWNLOADS=never UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
RUN groupadd --gid 10001 routecast && useradd --uid 10001 --gid 10001 --no-create-home routecast \
    && mkdir /state && chown 10001:10001 /state
# Explicit source allowlist keeps ignored environment files and development fixtures out of images.
COPY manage.py ./
COPY api ./api
COPY cache ./cache
COPY common ./common
COPY config ./config
COPY integrations ./integrations
COPY persistence ./persistence
COPY services ./services
COPY tasks ./tasks
USER 10001:10001
EXPOSE 8000
CMD ["gunicorn", "--config", "config/gunicorn.py", "config.wsgi:application"]
