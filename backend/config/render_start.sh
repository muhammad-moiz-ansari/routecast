#!/bin/sh
# Render free tier: no background workers or pre-deploy jobs, so one web service runs
# migrations, a single Celery worker for both queues, and the API. If either process
# exits, the container exits so Render restarts it.
set -eu

python manage.py migrate --noinput

celery -A config.celery:app worker -Q celery,corridor --concurrency=1 \
  --loglevel=info --hostname=render@%h &
worker=$!
gunicorn --config config/gunicorn.py --workers 1 config.wsgi:application &
api=$!

trap 'kill -TERM "$worker" "$api" 2>/dev/null; wait; exit 0' TERM INT
while kill -0 "$worker" 2>/dev/null && kill -0 "$api" 2>/dev/null; do
  sleep 5 &
  wait $!
done
kill -TERM "$worker" "$api" 2>/dev/null || true
wait
exit 1
