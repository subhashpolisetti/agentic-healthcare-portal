"""
Agent 5 — Discharge Planning Agent (Clinical Burnout Reduction)

Graph structure with conditional routing:

    START
      ↓
    generate_soap_notes  (Groq LLM — structured S/O/A/P + sets is_complex flag)
      ↓
    generate_discharge_summary  (Groq LLM — patient-friendly instructions)
      ↓ [conditional — routes by clinical complexity]
      ├── complex/chronic → suggest_followup → END
      └── acute/simple   → END

What makes this genuinely agentic:
  1. LLM reasoning — Groq generates clinically appropriate SOAP notes from minimal input
  2. LLM also self-classifies complexity (is_complex flag) — drives graph routing
  3. Conditional routing — follow-up node fires only when clinical context warrants it
  4. State enrichment — each node reads and builds on prior node output
  5. Doctor in the loop — output is editable before confirming discharge
"""

import json
import logging
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from app.services.groq_client import chat

log = logging.getLogger(__name__)


# ── State ─────────────────────────────────────────────────────────────────────

class DischargeState(TypedDict):
    # Input
    appointment_id:   int
    patient_name:     str
    doctor_name:      str
    specialty:        str
    chief_complaint:  str
    appointment_date: str
    clinical_analysis: str   # H6: Agent 2 output injected by Spring Boot proxy (may be empty)

    # Computed by nodes
    soap_notes:              str
    is_complex:              bool   # drives conditional routing
    discharge_summary:       str
    followup_days:           int    # 0 = no follow-up needed
    followup_recommendation: str

    error: str | None


# ── Node 1: Generate SOAP notes (Groq LLM) ────────────────────────────────────

def generate_soap_notes(state: DischargeState) -> DischargeState:
    """
    LLM reasoning node — generates structured SOAP notes AND self-classifies
    complexity. The is_complex flag drives whether suggest_followup fires.
    """
    try:
        system_prompt = (
            "You are a clinical documentation AI assistant. Generate SOAP notes for a medical visit.\n\n"
            "Return a JSON object (no markdown, no code block):\n"
            "{\n"
            '  "soap_notes": "**S (Subjective):** ...\\n**O (Objective):** ...\\n**A (Assessment):** ...\\n**P (Plan):** ...",\n'
            '  "is_complex": true or false\n'
            "}\n\n"
            "is_complex = true if the assessment involves any of: chronic condition, cardiac issue, "
            "diabetes, hypertension, cancer, mental health disorder, neurological condition, "
            "or requires specialist follow-up beyond a single visit.\n"
            "Write in professional clinical language. Infer Objective findings from specialty and chief complaint."
        )

        prior_analysis = state.get("clinical_analysis", "")
        clinical_ctx = (
            f"\n\nPrior clinical analysis from AI (Agent 2):\n{prior_analysis}\n"
            "Use this context to improve the clinical accuracy of the SOAP notes."
            if prior_analysis else ""
        )

        user_msg = (
            f"Patient: {state['patient_name']}\n"
            f"Doctor: {state['doctor_name']} ({state['specialty']})\n"
            f"Appointment date: {state['appointment_date']}\n"
            f"Chief complaint: {state['chief_complaint']}"
            f"{clinical_ctx}"
        )

        raw = chat(system_prompt=system_prompt, user_message=user_msg, max_tokens=600)

        clean = raw.strip().strip("```json").strip("```").strip()
        parsed = json.loads(clean)
        soap = parsed.get("soap_notes", "")
        is_complex = bool(parsed.get("is_complex", False))

        log.info("[Agent5] SOAP generated for appt %d, is_complex=%s",
                 state["appointment_id"], is_complex)
        return {**state, "soap_notes": soap, "is_complex": is_complex, "error": None}

    except Exception as e:
        log.error("[Agent5] generate_soap_notes failed: %s", e)
        fallback = (
            f"**S (Subjective):** Patient {state['patient_name']} presents with {state['chief_complaint']}.\n"
            f"**O (Objective):** Examination findings consistent with chief complaint.\n"
            f"**A (Assessment):** Clinical assessment by {state['doctor_name']} ({state['specialty']}).\n"
            "**P (Plan):** Treatment plan discussed with patient. Follow-up as needed."
        )
        return {**state, "soap_notes": fallback, "is_complex": False, "error": str(e)}


# ── Node 2: Generate discharge summary (Groq LLM) ─────────────────────────────

def generate_discharge_summary(state: DischargeState) -> DischargeState:
    """
    Generates a patient-friendly discharge summary based on the SOAP notes.
    Reads the soap_notes from state — downstream reasoning on prior node output.
    """
    try:
        system_prompt = (
            "You are a patient communication specialist in a hospital. "
            "Write a clear, empathetic discharge summary for the patient to take home.\n\n"
            "Include:\n"
            "1. What was found / diagnosis (in plain language)\n"
            "2. Medications or treatments prescribed\n"
            "3. Care instructions at home\n"
            "4. Warning signs to watch for\n\n"
            "Keep it under 150 words. Use plain language — no medical jargon. "
            "Write in second person ('You were seen for...')."
        )

        user_msg = (
            f"Patient: {state['patient_name']}\n"
            f"Doctor: {state['doctor_name']} ({state['specialty']})\n"
            f"Chief complaint: {state['chief_complaint']}\n\n"
            f"Clinical SOAP notes:\n{state['soap_notes']}\n\n"
            "Write the patient-facing discharge summary:"
        )

        summary = chat(system_prompt=system_prompt, user_message=user_msg, max_tokens=250)
        log.info("[Agent5] Discharge summary generated for appt %d", state["appointment_id"])
        return {**state, "discharge_summary": summary}

    except Exception as e:
        log.error("[Agent5] generate_discharge_summary failed: %s", e)
        fallback = (
            f"You were seen today by {state['doctor_name']} for {state['chief_complaint']}. "
            "Please follow the care plan discussed during your visit. "
            "Contact our office if symptoms worsen or new symptoms develop."
        )
        return {**state, "discharge_summary": fallback, "error": str(e)}


# ── Node 3: Suggest follow-up (complex cases only) ────────────────────────────

def suggest_followup(state: DischargeState) -> DischargeState:
    """
    Determines follow-up timing for complex/chronic cases.
    Only fires when is_complex=True (conditional routing decision).
    """
    try:
        system_prompt = (
            "You are a clinical care coordinator. Based on the SOAP notes, "
            "recommend a follow-up appointment timeline.\n\n"
            "Return JSON only (no markdown):\n"
            '{"followup_days": <integer, days until follow-up>, "recommendation": "<one sentence>"}\n\n'
            "Guidelines: cardiac/critical = 7 days, chronic management = 30 days, "
            "post-procedure = 14 days, mental health = 14 days."
        )

        user_msg = (
            f"Specialty: {state['specialty']}\n"
            f"Chief complaint: {state['chief_complaint']}\n"
            f"SOAP notes:\n{state['soap_notes']}"
        )

        raw = chat(system_prompt=system_prompt, user_message=user_msg, max_tokens=80)
        clean = raw.strip().strip("```json").strip("```").strip()
        parsed = json.loads(clean)
        days = int(parsed.get("followup_days", 30))
        recommendation = parsed.get("recommendation", f"Follow up with {state['doctor_name']} in {days} days.")

        log.info("[Agent5] Follow-up: %d days for appt %d", days, state["appointment_id"])
        return {**state, "followup_days": days, "followup_recommendation": recommendation}

    except Exception as e:
        log.error("[Agent5] suggest_followup failed: %s", e)
        return {
            **state,
            "followup_days": 30,
            "followup_recommendation": f"Please schedule a follow-up with {state['doctor_name']} within 30 days.",
            "error": str(e),
        }


# ── Routing ───────────────────────────────────────────────────────────────────

def route_by_complexity(state: DischargeState) -> Literal["suggest_followup", "__end__"]:
    """LLM set is_complex during generate_soap_notes — drives whether follow-up fires."""
    if state.get("is_complex"):
        return "suggest_followup"
    return "__end__"


# ── Build graph ───────────────────────────────────────────────────────────────

def _build_graph():
    graph = StateGraph(DischargeState)

    graph.add_node("generate_soap_notes",      generate_soap_notes)
    graph.add_node("generate_discharge_summary", generate_discharge_summary)
    graph.add_node("suggest_followup",         suggest_followup)

    graph.add_edge(START, "generate_soap_notes")
    graph.add_edge("generate_soap_notes", "generate_discharge_summary")

    graph.add_conditional_edges("generate_discharge_summary", route_by_complexity, {
        "suggest_followup": "suggest_followup",
        "__end__":          END,
    })

    graph.add_edge("suggest_followup", END)

    return graph.compile()


discharge_graph = _build_graph()


def run(
    appointment_id: int,
    patient_name: str,
    doctor_name: str,
    specialty: str,
    chief_complaint: str,
    appointment_date: str,
    clinical_analysis: str = "",
) -> dict:
    initial: DischargeState = {
        "appointment_id":        appointment_id,
        "patient_name":          patient_name,
        "doctor_name":           doctor_name,
        "specialty":             specialty,
        "chief_complaint":       chief_complaint,
        "appointment_date":      appointment_date,
        "clinical_analysis":     clinical_analysis,
        "soap_notes":            "",
        "is_complex":            False,
        "discharge_summary":     "",
        "followup_days":         0,
        "followup_recommendation": "",
        "error":                 None,
    }
    result = discharge_graph.invoke(initial)
    return {
        "soap_notes":              result["soap_notes"],
        "discharge_summary":       result["discharge_summary"],
        "followup_days":           result["followup_days"],
        "followup_recommendation": result["followup_recommendation"],
        "is_complex":              result["is_complex"],
        "error":                   result["error"],
    }
