"""
Agent 6b — Inbound Message Classifier (LangGraph)

Classifies patient replies to outbound notifications (SMS/email) so the care
team can triage quickly without reading every message.

Graph:
    START → classify_message → route_action → END

Classifications:
    RECOVERY_NORMAL      — patient confirms they're fine, close the thread
    RESCHEDULE_REQUEST   — patient wants a new time → flag for Agent 1 rebooking
    NEEDS_HELP           — patient has a question → queue for nurse review
    URGENT               — patient reports symptoms / emergency → escalate immediately
    UNRELATED            — spam or unrelated content → discard
"""

import logging
from typing import TypedDict

from langgraph.graph import END, StateGraph

from app.services.groq_client import chat

log = logging.getLogger(__name__)

CLASSIFICATIONS = ["RECOVERY_NORMAL", "RESCHEDULE_REQUEST", "NEEDS_HELP", "URGENT", "UNRELATED"]

SYSTEM_PROMPT = (
    "You are a medical triage classifier. Classify the patient message into exactly one of: "
    "RECOVERY_NORMAL, RESCHEDULE_REQUEST, NEEDS_HELP, URGENT, UNRELATED. "
    "Respond with ONLY the classification label — no explanation, no punctuation."
)


class InboundState(TypedDict):
    message_id: int
    from_address: str
    body: str
    classification: str
    action_taken: str


def classify_message(state: InboundState) -> InboundState:
    try:
        label = chat(
            system_prompt=SYSTEM_PROMPT,
            user_message=state["body"],
            max_tokens=10,
        ).strip().upper()
        if label not in CLASSIFICATIONS:
            # LLM returned unexpected output — queue for manual review, never silently discard
            log.error("[InboundAgent] Unexpected LLM output for msg %d: '%s'. "
                      "Routing to NEEDS_HELP for manual triage.", state["message_id"], label)
            label = "NEEDS_HELP"
    except Exception as e:
        # On any error, route to nurse review queue — never silently discard patient messages
        log.error("[InboundAgent] Classification failed for msg %d: %s. "
                  "Routing to NEEDS_HELP for manual triage.", state["message_id"], e)
        label = "NEEDS_HELP"

    log.info("[InboundAgent] msg=%d classified as %s", state["message_id"], label)
    return {**state, "classification": label}


def route_action(state: InboundState) -> InboundState:
    classification = state["classification"]
    action = "NONE"

    if classification == "URGENT":
        log.warning("[InboundAgent][URGENT] Patient %s reported emergency — manual escalation required",
                    state["from_address"])
        action = "ESCALATED"
    elif classification == "RESCHEDULE_REQUEST":
        log.info("[InboundAgent] Reschedule request from %s — flagged for Agent 1", state["from_address"])
        action = "FLAGGED_RESCHEDULE"
    elif classification == "NEEDS_HELP":
        action = "NEEDS_REVIEW"
    elif classification == "RECOVERY_NORMAL":
        action = "CLOSED"
    else:
        action = "DISCARDED"

    return {**state, "action_taken": action}


def _build_graph() -> StateGraph:
    g = StateGraph(InboundState)
    g.add_node("classify_message", classify_message)
    g.add_node("route_action", route_action)
    g.set_entry_point("classify_message")
    g.add_edge("classify_message", "route_action")
    g.add_edge("route_action", END)
    return g.compile()


_graph = _build_graph()


def run(message_id: int, from_address: str, body: str) -> dict:
    result = _graph.invoke({
        "message_id":   message_id,
        "from_address": from_address,
        "body":         body,
        "classification": "",
        "action_taken":   "",
    })
    return {
        "message_id":     result["message_id"],
        "classification": result["classification"],
        "action_taken":   result["action_taken"],
    }
