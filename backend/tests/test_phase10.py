"""Production configuration checks run in isolated processes without infrastructure."""

import json
import os
import subprocess
import sys

import pytest


def production(code, **updates):
    env = dict(
        os.environ,
        DJANGO_SETTINGS_MODULE="config.settings.production",
        DJANGO_SECRET_KEY="release-test-only-" + "abc123xyz-" * 6,
        DJANGO_ALLOWED_HOSTS="api.example.test",
        TOMTOM_API_KEY="",
    )
    env.update(updates)
    return subprocess.run([sys.executable, "-c", code], env=env, capture_output=True, text=True)


def test_production_proxy_host_docs_csrf_and_cookie_settings():
    result = production("""
import json
import django
django.setup()
from django.conf import settings
from django.test import Client, RequestFactory
from django.middleware.csrf import CsrfViewMiddleware
from django.http import HttpResponse
c=Client()
host={'HTTP_HOST':'api.example.test','HTTP_X_FORWARDED_PROTO':'https'}
assert c.get('/api/v1/health/', HTTP_HOST='api.example.test').status_code==301
bad=c.get('/api/v1/health/', HTTP_HOST='bad.example', HTTP_X_FORWARDED_PROTO='https')
assert bad.status_code==400
r=c.get('/api/v1/health/', HTTP_HOST='api.example.test', HTTP_X_FORWARDED_PROTO='https')
assert r.status_code==200 and r['X-Frame-Options']=='DENY'
assert c.get('/api/v1/docs', **host).status_code==404
assert c.get('/api/v1/openapi.json', **host).status_code==404
for origin,expected in [('https://api.example.test',None),('https://foreign.example',403)]:
    req=RequestFactory().post('/api/v1/trips/',data='{}',content_type='application/json',HTTP_HOST='api.example.test',HTTP_ORIGIN=origin,HTTP_X_FORWARDED_PROTO='https',HTTP_X_CSRFTOKEN='a'*32)
    req.COOKIES[settings.CSRF_COOKIE_NAME]='a'*32
    middleware=CsrfViewMiddleware(lambda _:HttpResponse())
    middleware.process_request(req)
    response=middleware.process_view(req,lambda _:HttpResponse(),(),{})
    assert (response.status_code if response else None)==expected
assert settings.SESSION_COOKIE_SECURE and settings.CSRF_COOKIE_SECURE
assert settings.CSRF_COOKIE_HTTPONLY
assert settings.SESSION_COOKIE_NAME.startswith('__Host-')
assert not settings.DEBUG
print(json.dumps({'secure':True,'docs':False}))
""")
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {"secure": True, "docs": False}


@pytest.mark.parametrize("key", ["", "short", "local-" + "abcd1234" * 8])
def test_production_rejects_weak_or_development_secret(key):
    result = production("import config.settings.production", DJANGO_SECRET_KEY=key)
    assert result.returncode != 0
    assert "DJANGO_SECRET_KEY" in result.stderr


@pytest.mark.parametrize("hosts", ["", "*", "https://example.test"])
def test_production_requires_explicit_hosts(hosts):
    result = production("import config.settings.production", DJANGO_ALLOWED_HOSTS=hosts)
    assert result.returncode != 0
    assert "DJANGO_ALLOWED_HOSTS" in result.stderr


def test_container_probe_preserves_host_and_fails_on_unready_dependencies(monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from config import healthcheck

    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", " api.example.test,other.example.test")
    response = SimpleNamespace(status=200)
    context = MagicMock()
    context.__enter__.return_value = response
    opener = MagicMock(return_value=context)
    monkeypatch.setattr(healthcheck, "urlopen", opener)
    healthcheck.check()
    request = opener.call_args.args[0]
    assert request.full_url == "http://127.0.0.1:8000/api/v1/ready/"
    assert request.get_header("Host") == "api.example.test"
    assert request.get_header("X-forwarded-proto") == "https"
    assert opener.call_args.kwargs["timeout"] == 8
    response.status = 503
    with pytest.raises(RuntimeError):
        healthcheck.check()
