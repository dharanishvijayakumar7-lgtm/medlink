"""Runtime configuration, loaded from environment / .env."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # postgresql+psycopg://user:password@host:port/dbname
    #
    # Note the database name: "medlink_app" is this companion app's own schema.
    # The LiveKit voice agent owns the separate, Alembic-managed "medlink"
    # database - do not point this at it.
    database_url: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/medlink_app"
    )

    # The mobile app is served from a different origin (Metro / device), so the
    # API stays open during development. Lock this down before any real deployment.
    cors_origins: list[str] = ["*"]


settings = Settings()
