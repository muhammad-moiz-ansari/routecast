import json
from datetime import UTC, datetime

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError

from persistence.stores.provider_budget_store import snapshot


class Command(BaseCommand):
    help = "Show this installation's provider allowances without sending provider requests."

    def handle(self, *args, **options):
        """Print limits/counters only; keys, addresses and coordinates are never included."""
        try:
            now = datetime.now(UTC)
            result = {
                provider: snapshot(provider, limits, now)
                for provider, limits in settings.PROVIDER_BUDGETS.items()
            }
        except DatabaseError:
            raise CommandError(
                "Could not read API usage. Check database readiness and migrations."
            ) from None
        self.stdout.write(json.dumps(result, indent=2))
