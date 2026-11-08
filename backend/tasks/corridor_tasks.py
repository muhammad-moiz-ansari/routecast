from config.celery import app


@app.task(name="routecast.corridor", ignore_result=True, soft_time_limit=840, time_limit=900)
def corridor(job_id):
    """Delegate corridor work independently from core planning tasks."""
    from api.dependencies import get_corridor_service

    get_corridor_service().execute(job_id)
