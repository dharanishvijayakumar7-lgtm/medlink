"""MedLink API.

Voice-based AI healthcare triage platform for rural India (SIH 2026).
This service backs the React Native companion app: patient identity capture,
symptom checks, the doctor queue, consultation notes, LiveKit teleconsultation
rooms, tracked referrals, facility stock, the voice-agent phone handoff, and
medical records patients upload from other hospitals.

There is deliberately no authentication yet.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  -- imported so create_all sees the tables
from app.config import settings
from app.database import Base, SessionLocal, engine
from app import document_processing
from app.routers import (
    consultations,
    doctors,
    documents,
    facilities,
    notes,
    patients,
    referrals,
    triage,
)
from app.schema_sync import sync_schema
from app.seed import seed_facilities, seed_stock

logger = logging.getLogger("medlink")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)

    # create_all adds missing tables but never alters existing ones.
    added = sync_schema(engine)
    if added:
        logger.info("schema sync added columns: %s", ", ".join(added))

    with SessionLocal() as db:
        seed_facilities(db)
        seed_stock(db)

    if not settings.livekit_configured:
        logger.warning(
            "LIVEKIT_* not set - teleconsultation endpoints will return 503."
        )

    if not settings.gemini_configured:
        logger.warning("GEMINI_API_KEY not set - uploaded documents will fail to process.")
    # Documents a restart left mid-flight would otherwise hang forever.
    resumed = document_processing.resume_unfinished()
    if resumed:
        logger.info("resumed extraction for %s unfinished document(s)", resumed)

    yield

    document_processing.shutdown()


app = FastAPI(title="MedLink API", version="2.0.0", lifespan=lifespan)

# The app runs on a device against this machine's LAN address, so the API is
# open during development. Restrict CORS_ORIGINS before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(doctors.router)
app.include_router(triage.router)
app.include_router(facilities.router)
app.include_router(referrals.router)
app.include_router(consultations.router)
app.include_router(notes.router)
app.include_router(documents.router)


@app.get("/health", tags=["meta"])
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "livekit_configured": settings.livekit_configured,
        "gemini_configured": settings.gemini_configured,
    }
