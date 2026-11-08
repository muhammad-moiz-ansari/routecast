from pydantic import BaseModel


class RefreshResult(BaseModel):
    analysis_id: str | None = None
    coalesced: bool = False
    retry_after_seconds: int | None = None
    stopped: bool = False
