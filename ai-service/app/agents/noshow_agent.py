"""
Agent 3 — No-Show Prediction Agent (Genuine Agentic Implementation)

Graph structure with real conditional routing:

    START
      ↓
    predict_risk  (ML model)
      ↓ [conditional — routes by risk level]
      ├── high/medium → generate_message (Groq LLM personalizes intervention)
      │                   ↓
      │               save_risk
      │                   ↓ [conditional — retry loop on failure]
      │               send_email
      │                   ↓
      │                  END
      │
      └── low → save_risk → END

What makes this genuinely agentic:
  1. Conditional routing — graph decides path based on state, not code
  2. LLM reasoning — Groq generates personalized intervention per patient context
  3. Retry loop — graph loops back on save failure (up to 2 retries)
  4. State accumulation — each node enriches shared state, next node reads it
"""

import logging
import os
from pathlib import Path
from typing import Literal, TypedDict

import httpx
import joblib
import numpy as np
from langgraph.graph import END, START, StateGraph

from app.services.groq_client import chat

log = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent.parent.parent / "noshow_model.pkl"
SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")
MAX_SAVE_RETRIES = 2

SPECIALTY_TYPE_MAP = {
    "Psychiatry": 2, "Addiction Psychiatry": 2,
    "Child & Adolescent Psychiatry": 2, "Addiction Medicine": 2,
    "Family Medicine": 0, "General Practice": 0,
    "Internal Medicine": 0, "Pediatrics": 0, "Geriatric Medicine": 0,
}

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    return _model


# ── State ─────────────────────────────────────────────────────────────────────

class NoShowState(TypedDict):
    # Input fields
    appointment_id: int
    patient_email: str
    patient_name: str
    doctor_name: str
    appointment_date: str
    slot_start_time: str
    specialty: str
    past_noshow_rate: float

    # Computed by nodes
    days_until_appointment: int
    risk_score: float
    risk_level: str               # high | medium | low
    intervention_message: str     # LLM-generated personalized message

    # Control flow
    save_retries: int
    save_succeeded: bool    # M3: explicit success flag — email only fires when save confirmed
    intervention_sent: bool
    error: str | None


# ── Node 1: Predict (ML model) ────────────────────────────────────────────────

def predict_risk(state: NoShowState) -> NoShowState:
    try:
        from datetime import date
        appt_date = date.fromisoformat(state["appointment_date"])
        day_of_week    = appt_date.weekday()
        hour_of_day    = int(state["slot_start_time"].split(":")[0])
        specialty_type = SPECIALTY_TYPE_MAP.get(state["specialty"], 1)
        days_until     = max(0, (appt_date - date.today()).days)
        past_rate      = state.get("past_noshow_rate", 0.0)

        features   = np.array([[day_of_week, hour_of_day, specialty_type, days_until, past_rate]])
        risk_score = float(_get_model().predict_proba(features)[0][1])
        risk_level = "high" if risk_score > 0.65 else "medium" if risk_score > 0.35 else "low"

        log.info("[Agent3] Appointment %d → risk %.2f (%s)", state["appointment_id"], risk_score, risk_level)
        return {**state, "risk_score": risk_score, "risk_level": risk_level,
                "days_until_appointment": days_until, "error": None}

    except Exception as e:
        log.error("[Agent3] predict_risk failed: %s", e)
        return {**state, "risk_score": 0.0, "risk_level": "low", "error": str(e)}


# ── Node 2: Generate message (Groq LLM decides tone and content) ──────────────

def generate_message(state: NoShowState) -> NoShowState:
    """
    LLM reasoning node — Groq generates a personalized intervention message.
    The agent decides tone, urgency, and content based on patient context.
    This is genuine LLM reasoning, not a template.
    """
    try:
        system_prompt = """You are an AI healthcare communication assistant.
Write a short, empathetic email message (2-3 sentences) to remind a patient about their
upcoming appointment. The tone should match the risk level:
- high risk: warm but urgent, mention that the slot can be given to another patient
- medium risk: friendly reminder, no pressure

Do NOT include subject line, greeting, or signature — only the message body.
Do NOT be robotic or generic. Reference the doctor's name and specialty."""

        user_msg = f"""
Patient: {state['patient_name']}
Doctor: {state['doctor_name']}
Specialty: {state['specialty']}
Appointment: {state['appointment_date']} at {state['slot_start_time']}
Days until appointment: {state['days_until_appointment']}
Risk level: {state['risk_level']}
Past no-show rate: {state['past_noshow_rate']:.0%}

Write the intervention message body:"""

        message = chat(system_prompt=system_prompt, user_message=user_msg, max_tokens=120)
        log.info("[Agent3] LLM generated intervention for appointment %d", state["appointment_id"])
        return {**state, "intervention_message": message}

    except Exception as e:
        log.error("[Agent3] generate_message failed: %s", e)
        # Fallback message — agent continues even if LLM fails
        fallback = (f"This is a reminder about your upcoming {state['specialty']} appointment "
                    f"with {state['doctor_name']} on {state['appointment_date']}. "
                    f"Please confirm or contact us to reschedule.")
        return {**state, "intervention_message": fallback}


# ── Node 3: Save risk to Spring Boot (with retry counter) ────────────────────

def save_risk(state: NoShowState) -> NoShowState:
    retries = state.get("save_retries", 0)
    try:
        url = f"{SPRING_BOOT_URL}/api/v1/appointments/{state['appointment_id']}/noshow-risk"
        params: dict = {"risk": round(state["risk_score"], 4)}
        # L2: persist intervention_message for audit trail (only if generated)
        msg = state.get("intervention_message", "")
        if msg:
            params["message"] = msg
        with httpx.Client(timeout=5.0) as client:
            resp = client.patch(url, params=params,
                                headers={"X-Internal-Service": "ai-service"})
            resp.raise_for_status()
        log.info("[Agent3] Saved risk %.2f for appointment %d", state["risk_score"], state["appointment_id"])
        return {**state, "save_retries": retries, "save_succeeded": True, "error": None}

    except Exception as e:
        log.warning("[Agent3] save_risk attempt %d failed: %s", retries + 1, e)
        new_retries = retries + 1
        if new_retries >= MAX_SAVE_RETRIES:
            # M3: permanent failure — dead-letter log so ops can retry manually
            log.error(
                "[Agent3][DEAD-LETTER] Permanently failed to save risk for appointment %d "
                "after %d attempts. risk=%.4f risk_level=%s error=%s",
                state["appointment_id"], new_retries, state.get("risk_score", 0),
                state.get("risk_level"), e,
            )
        return {**state, "save_retries": new_retries, "save_succeeded": False, "error": str(e)}


# ── Node 4: Send intervention email ──────────────────────────────────────────

def send_email(state: NoShowState) -> NoShowState:
    try:
        payload = {
            "patient_email": state["patient_email"],
            "patient_name": state["patient_name"],
            "doctor_name": state["doctor_name"],
            "appointment_date": state["appointment_date"],
            "slot_start_time": state["slot_start_time"],
            "risk_level": state["risk_level"],
            "intervention_message": state.get("intervention_message", ""),
        }
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(f"{SPRING_BOOT_URL}/api/v1/internal/noshow-email",
                               json=payload, headers={"X-Internal-Service": "ai-service"})
            resp.raise_for_status()
        log.info("[Agent3] Intervention email sent to %s", state["patient_email"])
        return {**state, "intervention_sent": True}
    except Exception as e:
        log.error("[Agent3] send_email failed: %s", e)
        return {**state, "intervention_sent": False, "error": str(e)}


# ── Routing functions (the "intelligence" of the graph) ───────────────────────

def route_by_risk(state: NoShowState) -> Literal["generate_message", "save_risk"]:
    """After prediction: high/medium risk → LLM generates message, low → just save."""
    if state["risk_level"] in ("high", "medium"):
        return "generate_message"
    return "save_risk"


def route_after_save(state: NoShowState) -> Literal["send_email", "save_risk", "__end__"]:
    """After save attempt: retry on failure (up to MAX_SAVE_RETRIES), then email or end.
    M3: email only fires when save_succeeded=True — never when DB write permanently failed.
    """
    if not state.get("save_succeeded") and state.get("save_retries", 0) < MAX_SAVE_RETRIES:
        return "save_risk"   # retry loop
    if state["risk_level"] in ("high", "medium") and state.get("save_succeeded"):
        return "send_email"
    return "__end__"


# ── Build graph ───────────────────────────────────────────────────────────────

def _build_graph():
    graph = StateGraph(NoShowState)

    graph.add_node("predict_risk",        predict_risk)
    graph.add_node("generate_message",    generate_message)
    graph.add_node("save_risk",           save_risk)
    graph.add_node("send_email",          send_email)

    graph.add_edge(START, "predict_risk")

    # Conditional: risk level decides next node
    graph.add_conditional_edges("predict_risk", route_by_risk, {
        "generate_message": "generate_message",
        "save_risk":        "save_risk",
    })

    # After LLM generates message → always save
    graph.add_edge("generate_message", "save_risk")

    # Conditional: retry loop or continue
    graph.add_conditional_edges("save_risk", route_after_save, {
        "save_risk":  "save_risk",    # retry
        "send_email": "send_email",
        "__end__":    END,
    })

    graph.add_edge("send_email", END)

    return graph.compile()


noshow_graph = _build_graph()


def run(appointment_id: int, patient_email: str, patient_name: str,
        doctor_name: str, appointment_date: str, slot_start_time: str,
        specialty: str, past_noshow_rate: float = 0.0) -> dict:
    initial: NoShowState = {
        "appointment_id":       appointment_id,
        "patient_email":        patient_email,
        "patient_name":         patient_name,
        "doctor_name":          doctor_name,
        "appointment_date":     appointment_date,
        "slot_start_time":      slot_start_time,
        "specialty":            specialty,
        "past_noshow_rate":     past_noshow_rate,
        "days_until_appointment": 0,
        "risk_score":           0.0,
        "risk_level":           "low",
        "intervention_message": "",
        "save_retries":         0,
        "save_succeeded":       False,
        "intervention_sent":    False,
        "error":                None,
    }
    result = noshow_graph.invoke(initial)
    return {
        "appointment_id":       result["appointment_id"],
        "risk_score":           result["risk_score"],
        "risk_level":           result["risk_level"],
        "intervention_message": result.get("intervention_message", ""),
        "intervention_sent":    result["intervention_sent"],
        "error":                result["error"],
    }
