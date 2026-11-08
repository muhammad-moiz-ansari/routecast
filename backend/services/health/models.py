"""Pydantic health contracts; they are separate from Django ORM models."""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class HealthStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["ok"] = "ok"


class ReadinessStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["ready", "unavailable"]
    database: bool
    cache: bool
