from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents import followup_agent

router = APIRouter(prefix="/agents/followup", tags=["followup"])


class FollowupRequest(BaseModel):
    appointment_id:       int
    patient_name:         str
    doctor_name:          str
    specialty:            str
    discharge_summary:    str
    days_since_discharge: int = 3


@router.post("/generate")
async def generate_followup(req: FollowupRequest):
    try:
        return followup_agent.run(
            appointment_id=req.appointment_id,
            patient_name=req.patient_name,
            doctor_name=req.doctor_name,
            specialty=req.specialty,
            discharge_summary=req.discharge_summary,
            days_since_discharge=req.days_since_discharge,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
