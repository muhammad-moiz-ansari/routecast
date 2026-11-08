"""Database access stays in persistence stores rather than service contracts."""

from django.db import DatabaseError, connection


def database_available() -> bool:
    """Execute a read-only probe without depending on business tables."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            return cursor.fetchone() == (1,)
    except DatabaseError:
        return False
