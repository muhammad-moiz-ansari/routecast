from datetime import UTC, timedelta
from math import ceil

from django.db import transaction


def periods(now):
    """Use fixed UTC calendar windows, including variable-length months."""
    now = now.astimezone(UTC)
    minute = now.replace(second=0, microsecond=0)
    hour = minute.replace(minute=0)
    day = hour.replace(hour=0)
    month = day.replace(day=1)
    next_month = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    return {
        "minute": (minute, minute + timedelta(minutes=1)),
        "hour": (hour, hour + timedelta(hours=1)),
        "day": (day, day + timedelta(days=1)),
        "month": (month, next_month),
    }


def reserve(provider, amount, limits, now):
    """Serialize reservations across PostgreSQL clients; commit before outbound I/O."""
    from persistence.models import ProviderBudget

    if type(amount) is not int or amount < 1:
        raise ValueError("Reservation must be a positive integer")
    # Durable atomic rejects an outer transaction that could refund usage after sending HTTP.
    with transaction.atomic(durable=True):
        ProviderBudget.objects.get_or_create(provider=provider)
        ledger = ProviderBudget.objects.select_for_update().get(provider=provider)
        windows, blocked = {}, []
        for period, (start, end) in periods(now).items():
            previous = ledger.windows.get(period, {})
            if previous.get("start", "") > start.isoformat():
                raise ValueError("Provider budget clock moved backwards")
            used = previous.get("used", 0) if previous.get("start") == start.isoformat() else 0
            if type(used) is not int or used < 0:
                raise ValueError("Invalid provider budget counter")
            if type(limits[period]) is not int or limits[period] < 0:
                raise ValueError("Invalid provider budget limit")
            windows[period] = {"start": start.isoformat(), "used": used + amount}
            if used + amount > limits[period]:
                blocked.append(max(1, ceil((end - now).total_seconds())))
        if blocked:
            return max(blocked)
        ledger.windows = windows
        ledger.save(update_fields=["windows"])
    return 0


def snapshot(provider, limits, now):
    """Read only active-window allowances; never reset counters from an inspection command."""
    from persistence.models import ProviderBudget

    ledger = ProviderBudget.objects.filter(provider=provider).first()
    windows = ledger.windows if ledger else {}
    result = {}
    for period, (start, end) in periods(now).items():
        record = windows.get(period, {})
        used = record.get("used", 0) if record.get("start") == start.isoformat() else 0
        result[period] = {
            "used": used,
            "limit": limits[period],
            "remaining": max(0, limits[period] - used),
            "resets_at": end.isoformat(),
        }
    return result
