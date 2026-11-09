from uuid import uuid4

from ninja.errors import HttpError, ValidationError

from common.exceptions import TripNotFound
from integrations.exceptions import ProviderError


def error_body(code, message, **extra):
    return {"code": code, "message": message, "request_id": str(uuid4()), **extra}


def register_errors(api):
    """Keep provider credentials, exception internals and invalid input values out of responses."""

    @api.exception_handler(ProviderError)
    def provider(request, exc):
        response = api.create_response(
            request,
            error_body(
                exc.code,
                exc.message,
                retry_after_seconds=exc.retry_after_seconds,
                trip_id=getattr(exc, "trip_id", None),
            ),
            status=exc.status,
        )
        if exc.retry_after_seconds:
            response["Retry-After"] = str(exc.retry_after_seconds)
        return response

    @api.exception_handler(TripNotFound)
    def missing(request, exc):
        return api.create_response(
            request, error_body("trip_not_found", "Trip not found."), status=404
        )

    @api.exception_handler(ValidationError)
    def invalid(request, exc):
        fields = [{"field": ".".join(map(str, e["loc"])), "message": e["msg"]} for e in exc.errors]
        return api.create_response(
            request,
            error_body("validation_error", "Invalid input.", field_errors=fields),
            status=422,
        )

    @api.exception_handler(HttpError)
    def http_error(request, exc):
        return api.create_response(
            request, error_body("request_rejected", str(exc.message)), status=exc.status_code
        )
