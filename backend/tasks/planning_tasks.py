from config.celery import app


@app.task(name="routecast.analyze", ignore_result=True, soft_time_limit=840, time_limit=900)
def analyze(run_id):
    """Delegate queued work to the composed planning service; no business logic in tasks."""
    from api.dependencies import get_planning_service

    get_planning_service().execute(run_id)


@app.task(name="routecast.refresh_tick", ignore_result=True)
def refresh_tick():
    """One Beat scheduler coordinates eligible trips; web processes run no polling loop."""
    from api.dependencies import get_refresh_service

    get_refresh_service().tick()
