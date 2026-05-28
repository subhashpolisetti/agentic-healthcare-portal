from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from app.agents import noshow_agent

router = APIRouter(prefix="/agents/noshow", tags=["noshow-agent"])


class NoShowRequest(BaseModel):
    appointment_id: int
    patient_email: str
    patient_name: str
    doctor_name: str
    appointment_date: str      # YYYY-MM-DD
    slot_start_time: str       # HH:MM
    specialty: str
    past_noshow_rate: float = 0.0


@router.post("/predict")
async def predict_noshow(req: NoShowRequest, background_tasks: BackgroundTasks):
    """
    Predict no-show risk for a booked appointment.
    Runs synchronously — Spring Boot calls this @Async so patient response is not blocked.
    """
    result = noshow_agent.run(
        appointment_id=req.appointment_id,
        patient_email=req.patient_email,
        patient_name=req.patient_name,
        doctor_name=req.doctor_name,
        appointment_date=req.appointment_date,
        slot_start_time=req.slot_start_time,
        specialty=req.specialty,
        past_noshow_rate=req.past_noshow_rate,
    )
    return result
