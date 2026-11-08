from pydantic import BaseModel


class FieldError(BaseModel):
    field: str
    message: str


class ErrorResponse(BaseModel):
    code: str
    message: str
    request_id: str
    field_errors: list[FieldError] | None = None
    retry_after_seconds: int | None = None
    trip_id: str | None = None


class SessionResponse(BaseModel):
    csrf_token: str


ERROR_RESPONSES = {status: ErrorResponse for status in (401, 403, 404, 422, 429, 503, 504)}
