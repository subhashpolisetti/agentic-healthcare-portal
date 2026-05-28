import logging
import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents import discharge_agent

log = logging.getLogger(__name__)
router = APIRouter(prefix="/agents/discharge", tags=["discharge"])

SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")


class DischargeGenerateRequest(BaseModel):
    appointment_id:   int
    patient_name:     str
    doctor_name:      str
    specialty:        str
    chief_complaint:  str
    appointment_date: str
    clinical_analysis: str = ""   # H6: injected by Spring Boot proxy from Agent 2 output


@router.post("/generate")
async def generate_discharge_notes(req: DischargeGenerateRequest):
    try:
        result = discharge_agent.run(
            appointment_id=req.appointment_id,
            patient_name=req.patient_name,
            doctor_name=req.doctor_name,
            specialty=req.specialty,
            chief_complaint=req.chief_complaint,
            appointment_date=req.appointment_date,
            clinical_analysis=req.clinical_analysis,
        )
        # H1: persist followup_days to DB so FollowupScheduler fires at the correct time
        # Agent 5 computed clinical timing (7d cardiac, 14d mental health, 30d chronic)
        _persist_followup_days(req.appointment_id, result.get("followup_days", 3))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _persist_followup_days(appointment_id: int, days: int) -> None:
    """Fire-and-forget: saves Agent 5 followup recommendation to Spring Boot. Non-fatal if it fails."""
    if not days or days <= 0:
        return
    try:
        url = f"{SPRING_BOOT_URL}/api/v1/appointments/{appointment_id}/followup-days"
        with httpx.Client(timeout=5.0) as client:
            resp = client.patch(url, params={"days": days},
                                headers={"X-Internal-Service": "ai-service"})
            resp.raise_for_status()
        log.info("[Agent5] Saved followup_days=%d for appointment %d", days, appointment_id)
    except Exception as e:
        log.warning("[Agent5] Failed to persist followup_days for appointment %d: %s",
                    appointment_id, e)
