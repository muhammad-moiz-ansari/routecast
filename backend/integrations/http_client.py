from threading import BoundedSemaphore

import httpx

from .exceptions import ProviderError
from .provider_budget import reserve_provider_budget

_slots = BoundedSemaphore(4)


class ProviderHTTP:
    def __init__(self, api_key, transport=None, budget=reserve_provider_budget):
        self.api_key = api_key
        self.transport = transport
        self.budget = budget

    def get(self, path, params):
        """Issue one bounded request, without retries or credential-bearing errors."""
        if not self.api_key:
            raise ProviderError("provider_not_configured", "TomTom is not configured.")
        if not _slots.acquire(timeout=1):
            raise ProviderError("provider_busy", "Routing/search capacity is busy.")
        try:
            self.budget("tomtom", 1)
            with httpx.Client(
                base_url="https://api.tomtom.com",
                timeout=httpx.Timeout(15, connect=3),
                transport=self.transport,
                follow_redirects=False,
                trust_env=False,
            ) as client:
                response = client.get(path, params={**params, "key": self.api_key})
            if response.status_code in (401, 403):
                raise ProviderError(
                    "provider_authentication", "Provider credentials were rejected."
                )
            if response.status_code == 429:
                retry = response.headers.get("Retry-After", "")
                raise ProviderError(
                    "provider_rate_limit",
                    "Provider request limit reached.",
                    429,
                    min(int(retry), 86400) if retry.isdigit() else None,
                )
            if response.status_code == 400:
                raise ProviderError(
                    "provider_invalid_request", "Provider rejected the route/search inputs.", 422
                )
            if response.status_code != 200:
                raise ProviderError("provider_unavailable", "Provider is unavailable.")
            try:
                return response.json()
            except ValueError:
                raise ProviderError(
                    "provider_invalid_response", "Provider returned invalid data."
                ) from None
        except httpx.TimeoutException:
            raise ProviderError("provider_timeout", "Provider request timed out.", 504) from None
        except httpx.HTTPError:
            raise ProviderError("provider_unavailable", "Provider could not be reached.") from None
        finally:
            _slots.release()
