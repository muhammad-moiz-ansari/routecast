import uuid

from django.db import models
from django.utils import timezone


class Trip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_id = models.UUIDField(db_index=True, editable=False)
    inputs = models.JSONField()
    input_revision = models.PositiveIntegerField(default=1)
    next_version = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    last_viewed_at = models.DateTimeField(default=timezone.now)
    last_manual_refresh = models.DateTimeField(null=True)
    current_analysis = models.ForeignKey(
        "AnalysisRun", null=True, blank=True, on_delete=models.SET_NULL, related_name="current_for"
    )
    status = models.CharField(max_length=24, default="routing")
    error_code = models.CharField(max_length=64, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class RouteSnapshot(models.Model):
    trip = models.OneToOneField(Trip, on_delete=models.CASCADE, related_name="route_snapshot")
    analysis_version = models.PositiveIntegerField(default=1)
    data = models.JSONField()


class AnalysisRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="analyses")
    revision = models.PositiveIntegerField()
    version = models.PositiveIntegerField()
    inputs = models.JSONField()
    status = models.CharField(max_length=24, default="queued")
    stage = models.CharField(max_length=24, default="queued")
    created_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True)
    lease_until = models.DateTimeField(null=True)
    token = models.UUIDField(null=True)
    attempts = models.PositiveIntegerField(default=0)
    dispatch_attempts = models.PositiveIntegerField(default=0)
    due_at = models.DateTimeField(default=timezone.now)
    error_code = models.CharField(max_length=64, null=True)
    payload = models.JSONField(null=True)
    working_routes = models.JSONField(null=True)
    dispatch_after = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["trip", "version"], name="analysis_trip_version"),
            models.UniqueConstraint(
                fields=["trip"],
                condition=models.Q(status__in=["queued", "running"]),
                name="one_active_analysis_per_trip",
            ),
        ]
