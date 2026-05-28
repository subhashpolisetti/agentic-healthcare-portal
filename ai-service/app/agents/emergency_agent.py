"""
Agent 4 — Emergency Monitor Agent

Graph structure with conditional routing:

    START
      ↓
    assess_vitals   (rules-based — checks each vital against clinical thresholds)
      ↓ [conditional — routes by severity]
      ├── warning/critical → generate_alert (Groq LLM — clinical recommendation)
      │                          ↓
      │                         END
      └── normal → END

What makes this genuinely agentic:
  1. Rules + LLM hybrid — thresholds detect anomaly, LLM interprets clinical meaning
  2. Conditional routing — LLM only fires when vitals warrant it (not on every tick)
  3. State-driven — each node enriches shared state
"""

import logging
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from app.services.groq_client import chat

log = logging.getLogger(__name__)

# Clinical thresholds
THRESHOLDS = {
    "heart_rate":    {"warning": (50, 100), "critical": (40, 130)},
    "spo2":          {"warning": 95.0,      "critical": 90.0},       # below these
    "bp_systolic":   {"warning": (90, 140), "critical": (80, 180)},
    "bp_diastolic":  {"warning": (60, 90),  "critical": (50, 110)},
    "temperature_f": {"warning": (97.0, 99.5), "critical": (95.0, 103.0)},
}


# ── State ─────────────────────────────────────────────────────────────────────

class EmergencyState(TypedDict):
    appointment_id:      int    # L3: correlates alert with specific admission
    patient_name:        str
    heart_rate:          float
    spo2:                float
    bp_systolic:         float
    bp_diastolic:        float
    temperature_f:       float

    status:              str    # normal | warning | critical
    abnormal_flags:      list   # list of {vital, value, concern}
    alert_message:       str    # Groq-generated clinical recommendation
    error: str | None


# ── Node 1: Assess vitals (rules-based) ───────────────────────────────────────

def assess_vitals(state: EmergencyState) -> EmergencyState:
    """
    Rules-based assessment against clinical thresholds.
    Determines severity level and collects abnormal flags.
    """
    flags = []
    severity = "normal"

    def _check_range(value, low, high, label, unit=""):
        nonlocal severity
        if value < low or value > high:
            flags.append({"vital": label, "value": f"{value}{unit}", "concern": "out of range"})
            return True
        return False

    # Heart rate
    c_lo, c_hi = THRESHOLDS["heart_rate"]["critical"]
    w_lo, w_hi = THRESHOLDS["heart_rate"]["warning"]
    hr = state["heart_rate"]
    if hr < c_lo or hr > c_hi:
        flags.append({"vital": "Heart Rate", "value": f"{hr} bpm", "concern": "critical"})
        severity = "critical"
    elif hr < w_lo or hr > w_hi:
        flags.append({"vital": "Heart Rate", "value": f"{hr} bpm", "concern": "warning"})
        if severity == "normal": severity = "warning"

    # SpO2
    spo2 = state["spo2"]
    if spo2 < THRESHOLDS["spo2"]["critical"]:
        flags.append({"vital": "SpO2", "value": f"{spo2}%", "concern": "critical — hypoxia"})
        severity = "critical"
    elif spo2 < THRESHOLDS["spo2"]["warning"]:
        flags.append({"vital": "SpO2", "value": f"{spo2}%", "concern": "warning — low oxygen"})
        if severity == "normal": severity = "warning"

    # Blood pressure
    sys = state["bp_systolic"]
    c_lo, c_hi = THRESHOLDS["bp_systolic"]["critical"]
    w_lo, w_hi = THRESHOLDS["bp_systolic"]["warning"]
    if sys < c_lo or sys > c_hi:
        flags.append({"vital": "Systolic BP", "value": f"{sys} mmHg", "concern": "critical"})
        severity = "critical"
    elif sys < w_lo or sys > w_hi:
        flags.append({"vital": "Systolic BP", "value": f"{sys} mmHg", "concern": "warning"})
        if severity == "normal": severity = "warning"

    # Temperature
    temp = state["temperature_f"]
    c_lo, c_hi = THRESHOLDS["temperature_f"]["critical"]
    w_lo, w_hi = THRESHOLDS["temperature_f"]["warning"]
    if temp < c_lo or temp > c_hi:
        flags.append({"vital": "Temperature", "value": f"{temp}°F", "concern": "critical"})
        severity = "critical"
    elif temp < w_lo or temp > w_hi:
        flags.append({"vital": "Temperature", "value": f"{temp}°F", "concern": "warning"})
        if severity == "normal": severity = "warning"

    log.info("[Agent4] appt=%s vitals assessed: status=%s flags=%d",
             state.get("appointment_id"), severity, len(flags))
    return {**state, "status": severity, "abnormal_flags": flags, "error": None}


# ── Node 2: Generate alert (Groq LLM) ─────────────────────────────────────────

def generate_alert(state: EmergencyState) -> EmergencyState:
    """
    LLM reasoning node — generates actionable clinical recommendation.
    Only fires for warning/critical status (conditional routing).
    """
    try:
        flags_text = "\n".join(
            f"- {f['vital']}: {f['value']} ({f['concern']})"
            for f in state["abnormal_flags"]
        )

        system_prompt = (
            "You are an AI clinical decision support system monitoring patient vitals. "
            "Based on the abnormal vital signs, provide a concise clinical recommendation "
            "for the attending nurse or doctor. Be specific and action-oriented. "
            "Keep under 60 words. No introductory phrases — start directly with the recommendation."
        )

        user_msg = (
            f"Patient: {state['patient_name']}\n"
            f"Severity: {state['status'].upper()}\n"
            f"Abnormal vitals:\n{flags_text}"
        )

        message = chat(system_prompt=system_prompt, user_message=user_msg, max_tokens=100)
        log.info("[Agent4] Alert generated for %s (%s)", state["patient_name"], state["status"])
        return {**state, "alert_message": message}

    except Exception as e:
        log.error("[Agent4] generate_alert failed: %s", e)
        severity = state["status"]
        flag_summary = ", ".join(f['vital'] for f in state["abnormal_flags"])
        fallback = f"{severity.capitalize()} vitals detected: {flag_summary}. Notify attending physician immediately."
        return {**state, "alert_message": fallback, "error": str(e)}


# ── Routing ───────────────────────────────────────────────────────────────────

def route_by_severity(state: EmergencyState) -> Literal["generate_alert", "__end__"]:
    if state["status"] in ("warning", "critical"):
        return "generate_alert"
    return "__end__"


# ── Build graph ───────────────────────────────────────────────────────────────

def _build_graph():
    graph = StateGraph(EmergencyState)

    graph.add_node("assess_vitals",  assess_vitals)
    graph.add_node("generate_alert", generate_alert)

    graph.add_edge(START, "assess_vitals")

    graph.add_conditional_edges("assess_vitals", route_by_severity, {
        "generate_alert": "generate_alert",
        "__end__":        END,
    })

    graph.add_edge("generate_alert", END)
    return graph.compile()


emergency_graph = _build_graph()


def run(
    appointment_id: int,
    patient_name: str,
    heart_rate: float,
    spo2: float,
    bp_systolic: float,
    bp_diastolic: float,
    temperature_f: float,
) -> dict:
    initial: EmergencyState = {
        "appointment_id": appointment_id,
        "patient_name":   patient_name,
        "heart_rate":     heart_rate,
        "spo2":           spo2,
        "bp_systolic":    bp_systolic,
        "bp_diastolic":   bp_diastolic,
        "temperature_f":  temperature_f,
        "status":         "normal",
        "abnormal_flags": [],
        "alert_message":  "",
        "error":          None,
    }
    result = emergency_graph.invoke(initial)
    return {
        "status":         result["status"],
        "abnormal_flags": result["abnormal_flags"],
        "alert_message":  result["alert_message"],
        "error":          result["error"],
    }
