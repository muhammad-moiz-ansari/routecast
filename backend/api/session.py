from uuid import UUID, uuid4

from django.conf import settings
from ninja.security import APIKeyCookie


class OwnerSessionAuth(APIKeyCookie):
    @property
    def param_name(self):
        return settings.SESSION_COOKIE_NAME

    def authenticate(self, request, key):
        """Use server-side anonymous ownership, never a client-supplied owner ID."""
        value = request.session.get("owner_id")
        return UUID(value) if value else None


def establish_owner(request):
    """Create an anonymous owner without rotating an existing session's ownership."""
    if not request.session.get("owner_id"):
        request.session["owner_id"] = str(uuid4())
