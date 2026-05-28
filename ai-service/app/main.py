import asyncio
import logging
import os
from collections import deque
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import matching, clinical, location, noshow, intake, discharge, emergency, followup, inbound, admin
from app.api.emergency import _vitals_windows, WINDOW_SIZE
from app.core.config import settings
from app.services.chroma_client import get_embedding_model, get_chroma_client

log = logging.getLogger(__name__)
SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")

_STARTUP_MAX_ATTEMPTS = 5
_STARTUP_BACKOFF = [2, 4, 8, 15, 30]   # seconds between attempts


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_embedding_model()
    get_chroma_client()

    # #1/#10: recover active monitoring sessions from Spring Boot on startup.
    # Spring Boot may still be booting — retry with backoff so cold-starts don't lose sessions.
    for attempt in range(_STARTUP_MAX_ATTEMPTS):
        try:
            resp = httpx.get(f"{SPRING_BOOT_URL}/api/v1/internal/monitoring/active", timeout=10.0)
            if resp.is_success:
                for appt_id in resp.json().get("appointment_ids", []):
                    _vitals_windows.setdefault(appt_id, deque(maxlen=WINDOW_SIZE))
                    log.info("[Startup] Recovered vitals window for appointment %d", appt_id)
            break  # success — stop retrying
        except Exception as e:
            wait = _STARTUP_BACKOFF[attempt] if attempt < len(_STARTUP_BACKOFF) else 30
            if attempt < _STARTUP_MAX_ATTEMPTS - 1:
                log.warning("[Startup] Attempt %d/%d — could not reach Spring Boot (%s). "
                            "Retrying in %ds.", attempt + 1, _STARTUP_MAX_ATTEMPTS, e, wait)
                await asyncio.sleep(wait)
            else:
                log.error("[Startup] Spring Boot unreachable after %d attempts — "
                          "active monitoring sessions NOT recovered. Error: %s",
                          _STARTUP_MAX_ATTEMPTS, e)

    yield


app = FastAPI(
    title="AI Healthcare Portal — AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(matching.router)
app.include_router(clinical.router)
app.include_router(location.router)
app.include_router(noshow.router)
app.include_router(intake.router)
app.include_router(discharge.router)
app.include_router(emergency.router)
app.include_router(followup.router)
app.include_router(inbound.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}
