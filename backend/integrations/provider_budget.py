from datetime import UTC, datetime

from django.conf import settings
from django.db import DatabaseError

from integrations.exceptions import ProviderError
from persistence.stores.provider_budget_store import reserve


def reserve_provider_budget(provider, amount):
    """Fail closed if a shared allowance cannot be reserved before a provider call."""
    try:
        wait = reserve(provider, amount, settings.PROVIDER_BUDGETS[provider], datetime.now(UTC))
    except (DatabaseError, RuntimeError, ValueError, TypeError, KeyError):
        raise ProviderError(
            "provider_budget_unavailable",
            "API usage protection is unavailable. No provider request was sent.",
        ) from None
    if wait:
        raise ProviderError(
            "provider_budget_exhausted",
            "The application's API allowance is exhausted. Try again after the allowance resets.",
            429,
            wait,
        )
