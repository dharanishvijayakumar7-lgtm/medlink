"""Additive column migrations for tables that already exist.

``Base.metadata.create_all`` creates missing tables but never alters existing
ones, so columns added to live tables are applied here instead. Every statement
is idempotent and runs after create_all, so a fresh database and an upgraded
one end up identical.

Two kinds of change are handled: adding a nullable-safe column, and relaxing
a NOT NULL constraint on a column that has become legacy. Nothing here ever
drops a column or rewrites existing values.

If the schema ever grows beyond additive changes, move to Alembic - the voice
agent's database already uses it.
"""

from sqlalchemy import text
from sqlalchemy.engine import Engine

# (table, column, column definition)
ADDED_COLUMNS: list[tuple[str, str, str]] = [
    ("triage_entries", "status", "VARCHAR(20) NOT NULL DEFAULT 'WAITING'"),
    ("triage_entries", "source", "VARCHAR(20) NOT NULL DEFAULT 'app'"),
    ("doctors", "facility_id", "INTEGER REFERENCES facilities(id)"),
    ("consultation_notes", "follow_up_due_date", "DATE"),
    (
        "consultation_notes",
        "follow_up_resolved",
        "BOOLEAN NOT NULL DEFAULT FALSE",
    ),
    # Replaces the self-reported age. Null for patients registered before it
    # existed - left null, never back-filled with a guessed date.
    ("patients", "date_of_birth", "DATE"),
]

# (table, column) whose NOT NULL is dropped because the column is now legacy.
# The data stays; new rows simply stop writing it.
RELAXED_COLUMNS: list[tuple[str, str]] = [
    ("patients", "age"),
]

# (index name, table, column) - mirrors index=True on the mapped columns.
ADDED_INDEXES: list[tuple[str, str, str]] = [
    ("ix_triage_entries_status", "triage_entries", "status"),
    ("ix_triage_entries_source", "triage_entries", "source"),
    (
        "ix_consultation_notes_follow_up_due_date",
        "consultation_notes",
        "follow_up_due_date",
    ),
    (
        "ix_consultation_notes_follow_up_resolved",
        "consultation_notes",
        "follow_up_resolved",
    ),
]


def sync_schema(engine: Engine) -> list[str]:
    """Apply the additive migrations. Returns the columns that were added."""
    added: list[str] = []

    with engine.begin() as connection:
        for table, column, definition in ADDED_COLUMNS:
            existing = connection.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = :table AND column_name = :column"
                ),
                {"table": table, "column": column},
            ).first()
            if existing:
                continue
            connection.execute(
                text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
            )
            added.append(f"{table}.{column}")

        for table, column in RELAXED_COLUMNS:
            nullable = connection.execute(
                text(
                    "SELECT is_nullable FROM information_schema.columns "
                    "WHERE table_name = :table AND column_name = :column"
                ),
                {"table": table, "column": column},
            ).scalar()
            if nullable == "NO":
                connection.execute(
                    text(f"ALTER TABLE {table} ALTER COLUMN {column} DROP NOT NULL")
                )
                added.append(f"{table}.{column} now nullable")

        for index_name, table, column in ADDED_INDEXES:
            connection.execute(
                text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table} ({column})")
            )

    return added
