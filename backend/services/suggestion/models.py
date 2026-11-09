from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SuggestionKind = Literal["route", "timing", "cargo", "caution", "data"]


class Suggestion(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    kind: SuggestionKind
    text: str = Field(min_length=1, max_length=240)


class SuggestionResult(BaseModel):
    analysis_version: int
    generated_at: datetime
    model: str
    cached: bool = False
    suggestions: list[Suggestion] = Field(min_length=1, max_length=3)
