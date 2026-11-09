import json

import httpx

from integrations.exceptions import ProviderError
from integrations.provider_budget import reserve_provider_budget


class GroqChatClient:
    def __init__(self, api_key, model, transport=None, budget=reserve_provider_budget):
        self.api_key = api_key
        self.model = model
        self.transport = transport
        self.budget = budget

    def complete_json(self, prompt, schema):
        """Send one schema-constrained chat request; no retries or credential-bearing errors."""
        if not self.api_key:
            raise ProviderError("ai_not_configured", "AI suggestions are not configured.")
        self.budget("groq", 1)
        body = {
            "model": self.model,
            # Groq recommends instructions in the user message for gpt-oss models.
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "suggestions", "strict": True, "schema": schema},
            },
            "reasoning_effort": "low",
            "include_reasoning": False,
            "max_completion_tokens": 800,
            "temperature": 0.2,
        }
        try:
            with httpx.Client(
                base_url="https://api.groq.com",
                timeout=httpx.Timeout(20, connect=3),
                transport=self.transport,
                follow_redirects=False,
                trust_env=False,
            ) as client:
                response = client.post(
                    "/openai/v1/chat/completions",
                    json=body,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
        except httpx.TimeoutException:
            raise ProviderError("ai_timeout", "The AI provider timed out.", 504) from None
        except httpx.HTTPError:
            raise ProviderError("ai_unavailable", "The AI provider could not be reached.") from None
        if response.status_code in (401, 403):
            raise ProviderError("ai_authentication", "The AI provider rejected the credentials.")
        if response.status_code == 429:
            retry = response.headers.get("Retry-After", "")
            raise ProviderError(
                "ai_rate_limit",
                "The AI provider's request limit was reached.",
                429,
                min(int(retry), 86400) if retry.isdigit() else None,
            )
        if response.status_code in (400, 404, 422):
            raise ProviderError(
                "ai_request_rejected", "The AI provider rejected the request. Check GROQ_MODEL."
            )
        if response.status_code != 200:
            raise ProviderError("ai_unavailable", "The AI provider is unavailable.")
        try:
            return json.loads(response.json()["choices"][0]["message"]["content"])
        except (ValueError, KeyError, IndexError, TypeError):
            raise ProviderError(
                "ai_invalid_response", "The AI provider returned invalid data."
            ) from None
