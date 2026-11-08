import uuid

from django.db import models


class Trip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_id = models.UUIDField(db_index=True, editable=False)
    inputs = models.JSONField()
    status = models.CharField(max_length=24, default="routing")
    error_code = models.CharField(max_length=64, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class RouteSnapshot(models.Model):
    trip = models.OneToOneField(Trip, on_delete=models.CASCADE, related_name="route_snapshot")
    analysis_version = models.PositiveIntegerField(default=1)
    data = models.JSONField()
