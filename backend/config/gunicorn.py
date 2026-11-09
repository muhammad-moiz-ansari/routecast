"""Linux HTTP process; background analyses run only in separate Celery workers."""

bind = "0.0.0.0:8000"
workers = 2
worker_class = "gthread"
threads = 4
timeout = 30
graceful_timeout = 30
keepalive = 5
max_requests = 1000
max_requests_jitter = 100
worker_tmp_dir = "/tmp"
# Deployments manage this process; no management socket may write to the absent user home.
control_socket_disable = True
# Django trusts the controlled gateway header. Gunicorn does not independently infer proxy schemes.
forwarded_allow_ips = ""
secure_scheme_headers = {}
accesslog = "-"
errorlog = "-"
# Place-search query strings can include private addresses; do not log them or headers.
access_log_format = '%(h)s %(m)s %(U)s %(s)s %(L)s'
