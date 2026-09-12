"""LiveKit access tokens for consultation rooms.

Rooms are not created up front: LiveKit creates a room automatically when the
first participant joins with a valid token. That keeps the request path free of
an extra network round-trip, and an abandoned consultation leaves no empty room
behind.
"""

import secrets
from datetime import timedelta

from livekit import api

from app.config import settings

# Long enough that a consultation is never cut short by an expired token, short
# enough that a leaked one is not useful for long.
TOKEN_TTL = timedelta(hours=2)


class LiveKitNotConfigured(RuntimeError):
    """Raised when LIVEKIT_* settings are missing from the environment."""


def new_room_name(unique_code: str) -> str:
    """A room name that is unique per consultation but readable in the console."""
    return f"consult-{unique_code}-{secrets.token_hex(4)}"


def mint_token(*, room_name: str, identity: str, display_name: str) -> str:
    """Mint a join token for one participant of one room."""
    if not settings.livekit_configured:
        raise LiveKitNotConfigured(
            "LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in "
            "backend/.env before a consultation can start."
        )

    grants = api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
    )

    return (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name(display_name)
        .with_grants(grants)
        .with_ttl(TOKEN_TTL)
        .to_jwt()
    )
