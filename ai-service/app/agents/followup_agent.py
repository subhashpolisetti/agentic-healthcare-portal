"""
Agent 6 — Post-Visit Follow-up Agent

Graph structure with conditional routing:

    START
      ↓
    generate_message   (Groq LLM — personalized follow-up based on discharge summary)
      ↓ [conditional — routes by whether discharge summary mentions ongoing concerns]
      ├── has_concerns → add_urgent_note (Groq — appends urgent care reminder) → END
      └── routine      → END

What makes this genuinely agentic:
  1. LLM reasoning — Groq generates personalized message from clinical context
  2. Conditional routing — urgent note only added when concerns detected in discharge
  3. State enrichment — base message from node 1 enriched by node 2 if needed
"""

import logging
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from app.services.groq_client import chat

log = logging.getLogger(__name__)

CONCERN_KEYWORDS = {
    "chronic", "diabetes", "hypertension", "cardiac", "heart", "respiratory",
    "follow up", "monitor", "prescription", "medication", "specialist",
    "referral", "ongoing", "management", "control",
}


# ── State ─────────────────────────────────────────────────────────────────────

class FollowupState(TypedDict):
    appointment_id:    int
    patient_name:      str
    doctor_name:       str
    specialty:         str
    discharge_summary: str
    days_since_discharge: int

    followup_message:  str
    has_concerns:      bool
    error: str | None


# ── Node 1: Generate follow-up message (Groq LLM) ─────────────────────────────

def generate_message(state: FollowupState) -> FollowupState:
    """
    LLM generates a personalized post-discharge follow-up message.
    Reads the discharge summary to make it contextually relevant.
    """
    try:
        system_prompt = (
            "You are a compassionate healthcare communication assistant. "
            "Write a warm, brief follow-up message (3-4 sentences) to a patient "
            f"{state['days_since_discharge']} days after their discharge.\n\n"
            "Reference their specific care context. Ask how they are feeling. "
            "Remind them of any key care instructions from their discharge. "
            "Do NOT include subject line, greeting, or signature — body only."
        )

        user_msg = (
            f"Patient: {state['patient_name']}\n"
            f"Treating doctor: {state['doctor_name']} ({state['specialty']})\n"
            f"Days since discharge: {state['days_since_discharge']}\n\n"
            f"Discharge summary:\n{state['discharge_summary']}"
        )

        message = chat(system_prompt=system_prompt, user_message=user_msg, max_tokens=150)

        has_concerns = any(kw in state["discharge_summary"].lower() for kw in CONCERN_KEYWORDS)
        log.info("[Agent6] Follow-up message generated for appt %d, has_concerns=%s",
                 state["appointment_id"], has_concerns)
        return {**state, "followup_message": message, "has_concerns": has_concerns, "error": None}

    except Exception as e:
        log.error("[Agent6] generate_message failed: %s", e)
        fallback = (
            f"We hope you are recovering well following your recent visit with {state['doctor_name']}. "
            "Please remember to follow the care instructions from your discharge summary. "
            "Do not hesitate to reach out if you have any questions or concerns."
        )
        return {**state, "followup_message": fallback, "has_concerns": False, "error": str(e)}


# ── Node 2: Add urgent note (Groq — only for chronic/concerning cases) ────────

def add_urgent_note(state: FollowupState) -> FollowupState:
    """
    Appends a condition-specific reminder for patients with ongoing concerns.
    Only fires when generate_message detected concerning terms in discharge summary.
    """
    try:
        system_prompt = (
            "Based on this patient's discharge context, write one concise sentence (under 20 words) "
            "reminding them about a specific follow-up action they should take. "
            "Be specific to their condition. No generic advice."
        )
        user_msg = (
            f"Specialty: {state['specialty']}\n"
            f"Discharge summary: {state['discharge_summary'][:300]}"
        )

        reminder = chat(system_prompt=system_prompt, user_message=user_msg, max_tokens=50)
        enriched = state["followup_message"] + " " + reminder
        log.info("[Agent6] Urgent note added for appt %d", state["appointment_id"])
        return {**state, "followup_message": enriched}

    except Exception as e:
        log.error("[Agent6] add_urgent_note failed: %s", e)
        return state   # return unchanged message if this node fails


# ── Routing ───────────────────────────────────────────────────────────────────

def route_by_concerns(state: FollowupState) -> Literal["add_urgent_note", "__end__"]:
    if state.get("has_concerns"):
        return "add_urgent_note"
    return "__end__"


# ── Build graph ───────────────────────────────────────────────────────────────

def _build_graph():
    graph = StateGraph(FollowupState)

    graph.add_node("generate_message", generate_message)
    graph.add_node("add_urgent_note",  add_urgent_note)

    graph.add_edge(START, "generate_message")

    graph.add_conditional_edges("generate_message", route_by_concerns, {
        "add_urgent_note": "add_urgent_note",
        "__end__":         END,
    })

    graph.add_edge("add_urgent_note", END)
    return graph.compile()


followup_graph = _build_graph()


def run(
    appointment_id: int,
    patient_name: str,
    doctor_name: str,
    specialty: str,
    discharge_summary: str,
    days_since_discharge: int = 3,
) -> dict:
    initial: FollowupState = {
        "appointment_id":       appointment_id,
        "patient_name":         patient_name,
        "doctor_name":          doctor_name,
        "specialty":            specialty,
        "discharge_summary":    discharge_summary,
        "days_since_discharge": days_since_discharge,
        "followup_message":     "",
        "has_concerns":         False,
        "error":                None,
    }
    result = followup_graph.invoke(initial)
    return {
        "followup_message": result["followup_message"],
        "has_concerns":     result["has_concerns"],
        "error":            result["error"],
    }
