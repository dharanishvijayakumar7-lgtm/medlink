"""MedLink API - Part 1.

Voice-based AI healthcare triage platform for rural India (SIH 2026).
This service backs the React Native companion app: patient identity capture,
symptom checks, the doctor queue and consultation notes.

There is deliberately no authentication in Part 1.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  -- imported so create_all sees the tables
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import doctors, facilities, patients, triage
from app.seed import seed_facilities


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_facilities(db)
    yield


app = FastAPI(title="MedLink API", version="1.0.0", lifespan=lifespan)

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


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
