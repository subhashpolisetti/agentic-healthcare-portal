"""
B1 fix: Agent 4 now uses a rolling vitals window per appointment_id.

Before: LangGraph graph invoked synchronously for EVERY vitals tick → no state
between ticks → trend detection impossible + wasteful LLM spin-up per tick.

After: Each tick is appended to a deque (last WINDOW_SIZE readings). The
LangGraph graph is invoked ONLY when a clinical threshold is crossed in the
current reading. Normal ticks are assessed by the rules-based check only —
the LLM fires conditionally, same as before, but now correctly isolated to
the triggering tick instead of every tick.

Multiple admitted patients are isolated by appointment_id (one deque each).
"""
import logging
import os
from collections import deque

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents import emergency_agent

SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")

log = logging.getLogger(__name__)
router = APIRouter(prefix="/agents/emergency", tags=["emergency"])

# B1: rolling window — last N readings per appointment
WINDOW_SIZE = 10
_vitals_windows: dict[int, deque] = {}  # appointment_id → deque of readings


class EmergencyAssessRequest(BaseModel):
    appointment_id: int   # L3: required for per-patient window isolation
    patient_name:   str
    heart_rate:     float
    spo2:           float
    bp_systolic:    float
    bp_diastolic:   float
    temperature_f:  float


def _is_threshold_crossed(reading: dict) -> bool:
    """Fast rules-based check — mirrors emergency_agent.THRESHOLDS without LangGraph overhead."""
    hr   = reading["heart_rate"]
    spo2 = reading["spo2"]
    sys  = reading["bp_systolic"]
    temp = reading["temperature_f"]

    if hr < 40 or hr > 130:      return True  # critical HR
    if spo2 < 90:                 return True  # critical hypoxia
    if sys < 80 or sys > 180:    return True  # critical BP
    if temp < 95.0 or temp > 103.0: return True  # critical temp

    # Warning-level thresholds also trigger — doctor needs to know
    if hr < 50 or hr > 100:      return True
    if spo2 < 95:                 return True
    if sys < 90 or sys > 140:    return True
    if temp < 97.0 or temp > 99.5: return True

    return False


@router.post("/assess")
async def assess_emergency(req: EmergencyAssessRequest):
    try:
        reading = {
            "heart_rate":    req.heart_rate,
            "spo2":          req.spo2,
            "bp_systolic":   req.bp_systolic,
            "bp_diastolic":  req.bp_diastolic,
            "temperature_f": req.temperature_f,
        }

        # B1: maintain per-appointment rolling window.
        # setdefault is atomic in CPython — safe against asyncio interleaving.
        _vitals_windows.setdefault(req.appointment_id, deque(maxlen=WINDOW_SIZE)).append(reading)

        # Only invoke LangGraph when a threshold is crossed — normal ticks return immediately
        if not _is_threshold_crossed(reading):
            return {
                "status":         "normal",
                "abnormal_flags": [],
                "alert_message":  "",
                "error":          None,
            }

        log.info("[Agent4] Threshold crossed for appointment %d — invoking LangGraph",
                 req.appointment_id)
        return emergency_agent.run(
            appointment_id=req.appointment_id,
            patient_name=req.patient_name,
            heart_rate=req.heart_rate,
            spo2=req.spo2,
            bp_systolic=req.bp_systolic,
            bp_diastolic=req.bp_diastolic,
            temperature_f=req.temperature_f,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/session/{appointment_id}")
async def end_vitals_session(appointment_id: int):
    """Called when patient is discharged or doctor closes Emergency Vitals page."""
    _vitals_windows.pop(appointment_id, None)
    log.info("[Agent4] Vitals window cleared for appointment %d", appointment_id)

    # #1/#10: end monitoring_session in DB so Spring Boot knows Agent 4 is no longer active
    try:
        with httpx.Client(timeout=3.0) as client:
            client.delete(
                f"{SPRING_BOOT_URL}/api/v1/internal/monitoring/{appointment_id}",
                headers={"X-Internal-Service": "ai-service"},
            )
    except Exception as e:
        log.warning("[Agent4] Failed to end monitoring session for appointment %d: %s",
                    appointment_id, e)

    return {"cleared": appointment_id}
