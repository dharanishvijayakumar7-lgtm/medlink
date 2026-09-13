"""Runtime configuration, loaded from environment / .env."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


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

    # The same LiveKit project the voice agent uses - one real-time stack.
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    # Document extraction. Gemini reads uploaded PDFs directly; it is used for
    # this task only and does not replace any voice-agent provider.
    #
    # Chosen by testing on a typed discharge summary and an image-only phone
    # scan: both Flash-Lite models matched gemini-3.8-flash on every clinical
    # check (lab flags, medicines, day-first dates) while sitting in the more
    # generous free-quota tier - and 3.8-flash returned 503 "high demand" mid
    # test. The fallback is a different model so it draws on its own quota
    # when the primary is rate-limited or overloaded.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"
    gemini_fallback_model: str = "gemini-3.5-flash-lite"

    # Uploaded PDFs live on local disk for the hackathon. Move this to real
    # object storage before anything beyond a demo.
    uploads_dir: Path = BACKEND_DIR / "uploads"
    # Gemini accepts PDFs inline up to ~20 MB per request, so stay under it.
    max_upload_bytes: int = 15 * 1024 * 1024

    # The mobile app is served from a different origin (Metro / device), so the
    # API stays open during development. Lock this down before any real deployment.
    cors_origins: list[str] = ["*"]

    @property
    def livekit_configured(self) -> bool:
        return bool(self.livekit_url and self.livekit_api_key and self.livekit_api_secret)

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)


settings = Settings()
