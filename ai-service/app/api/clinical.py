import json
import logging
import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

from app.agents import clinical_agent
from app.services.chroma_client import embed, get_patient_cases_collection
from app.services.groq_client import chat

log = logging.getLogger(__name__)
router = APIRouter(tags=["clinical"])

SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")


# ── Agent 2 — Clinical Decision Support (LangGraph) ──────────────────────────

class ClinicalAgentRequest(BaseModel):
    appointment_id:  int
    patient_name:    str
    specialty:       str
    chief_complaint: str


@router.post("/agents/clinical/analyze")
async def analyze_clinical(req: ClinicalAgentRequest):
    # #2: status lifecycle — IN_PROGRESS is set by AdmittedEventListener before calling here
    try:
        result = clinical_agent.run(
            appointment_id=req.appointment_id,
            patient_name=req.patient_name,
            specialty=req.specialty,
            chief_complaint=req.chief_complaint,
        )
        # B3: persist Agent 2 output to DB; also marks status READY
        _persist_clinical_analysis(req.appointment_id, result)
        return result
    except Exception as e:
        try:
            _update_analysis_status(req.appointment_id, "FAILED")
        except Exception as status_err:
            log.critical("[Agent2] Failed to mark appointment %d as FAILED after agent error — "
                         "status is stuck. Error: %s", req.appointment_id, status_err)
        raise HTTPException(status_code=500, detail=str(e))


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8),
       reraise=True)
def _update_analysis_status_with_retry(appointment_id: int, status: str) -> None:
    url = f"{SPRING_BOOT_URL}/api/v1/appointments/{appointment_id}/analysis-status"
    with httpx.Client(timeout=5.0) as client:
        client.patch(url, params={"status": status},
                     headers={"X-Internal-Service": "ai-service"})


def _update_analysis_status(appointment_id: int, status: str) -> None:
    """Updates analysis_status field — retries 3x with backoff, logs on final failure."""
    try:
        _update_analysis_status_with_retry(appointment_id, status)
    except Exception as e:
        log.warning("[Agent2] Failed to update analysis_status=%s for appointment %d after retries: %s",
                    status, appointment_id, e)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8),
       reraise=True)
def _persist_with_retry(appointment_id: int, params: dict) -> None:
    url = f"{SPRING_BOOT_URL}/api/v1/appointments/{appointment_id}/clinical-analysis"
    with httpx.Client(timeout=5.0) as client:
        resp = client.patch(url, params=params,
                            headers={"X-Internal-Service": "ai-service"})
        resp.raise_for_status()


def _persist_clinical_analysis(appointment_id: int, result: dict) -> None:
    """Saves clinical analysis to Spring Boot and marks status READY — retries 3x."""
    try:
        analysis = result.get("analysis", "")
        flags = result.get("critical_flags", [])
        params = {
            "analysis": analysis,
            "criticalFlags": json.dumps(flags) if flags else None,
        }
        _persist_with_retry(appointment_id, {k: v for k, v in params.items() if v is not None})
        log.info("[Agent2] Persisted clinical analysis for appointment %d", appointment_id)
        # #2: mark READY only after successful persist
        _update_analysis_status(appointment_id, "READY")
    except Exception as e:
        log.warning("[Agent2] Failed to persist clinical analysis for appointment %d: %s",
                    appointment_id, e)
        try:
            _update_analysis_status(appointment_id, "FAILED")
        except Exception as status_err:
            log.critical("[Agent2] Also failed to mark appointment %d as FAILED after persist error — "
                         "status is stuck. Error: %s", appointment_id, status_err)


# ── Similar cases — ChromaDB vector search ────────────────────────────────────

@router.get("/cases/similar")
async def similar_cases(symptoms: str, top_k: int = 5):
    try:
        collection = get_patient_cases_collection()
        results = collection.query(
            query_embeddings=[embed(symptoms)],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
        cases = [
            {"document": doc, "metadata": meta, "score": round(1 - dist, 4)}
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            )
        ]
        return {"cases": cases, "symptoms": symptoms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Plain LLM clinical analysis (no LangGraph) ───────────────────────────────

class ClinicalAnalysisRequest(BaseModel):
    symptoms: str
    case_documents: list[str] = []


@router.post("/clinical/analysis")
async def clinical_analysis(req: ClinicalAnalysisRequest):
    try:
        case_context = "\n\n".join(req.case_documents[:3]) if req.case_documents else "No similar cases provided."
        analysis = chat(
            system_prompt=(
                "You are an AI clinical decision support assistant helping doctors. "
                "Analyze the patient symptoms and similar historical cases. "
                "Provide: 1) Differential diagnosis (top 3), 2) Suggested workup, "
                "3) Red flags to watch for. Be concise and clinically accurate. "
                "Always remind the doctor that this is AI assistance, not a final diagnosis."
            ),
            user_message=f"Patient symptoms: {req.symptoms}\n\nSimilar cases:\n{case_context}",
            max_tokens=512,
        )
        return {"analysis": analysis, "symptoms": req.symptoms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
