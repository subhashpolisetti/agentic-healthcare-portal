"""
Agent 2 — Clinical Decision Support Agent

Graph structure with conditional routing:

    START
      ↓
    search_cases     (ChromaDB — finds similar patient cases by specialty + symptoms)
      ↓
    analyze_findings (Groq LLM — generates clinical analysis from case evidence)
      ↓ [conditional — routes by whether critical conditions detected]
      ├── critical → flag_critical (Groq LLM — extracts specific risk flags) → END
      └── normal   → END

What makes this genuinely agentic:
  1. Real data retrieval — ChromaDB vector search over clinical case library
  2. LLM reasoning — Groq synthesizes case evidence into actionable analysis
  3. Conditional routing — critical flag node only fires when LLM detects danger signs
  4. State enrichment — analysis from node 2 feeds into node 3
"""

import json
import logging
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from app.services.chroma_client import embed, get_patient_cases_collection
from app.services.groq_client import chat

log = logging.getLogger(__name__)



# ── State ─────────────────────────────────────────────────────────────────────

class ClinicalState(TypedDict):
    appointment_id: int
    patient_name:   str
    specialty:      str
    chief_complaint: str

    similar_cases:  list
    analysis:       str
    is_critical:    bool
    critical_flags: list
    error: str | None


# ── Node 1: Search similar cases (ChromaDB) ───────────────────────────────────

def search_cases(state: ClinicalState) -> ClinicalState:
    """Vector search for similar clinical cases matching specialty + chief complaint."""
    try:
        collection = get_patient_cases_collection()
        query = f"{state['specialty']} {state['chief_complaint']}".strip()
        embedding = embed(query)

        results = collection.query(
            query_embeddings=[embedding],
            n_results=5,
            include=["documents", "metadatas", "distances"],
        )

        cases = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            cases.append({
                "document": doc[:500],
                "similarity": round(1 - dist, 4),
                "id": meta.get("id", ""),
            })

        log.info("[Agent2] Found %d similar cases for %s", len(cases), state["specialty"])
        return {**state, "similar_cases": cases, "error": None}

    except Exception as e:
        log.error("[Agent2] search_cases failed: %s", e)
        return {**state, "similar_cases": [], "error": str(e)}


# ── Node 2: Analyze findings (Groq LLM) ───────────────────────────────────────

def analyze_findings(state: ClinicalState) -> ClinicalState:
    """
    LLM reasoning node — synthesizes similar case evidence into clinical analysis.
    Genuine reasoning: model interprets case patterns, not keyword matching.
    """
    try:
        case_text = "\n\n".join(
            f"Case {i+1} (similarity {c['similarity']:.0%}):\n{c['document']}"
            for i, c in enumerate(state["similar_cases"])
        ) if state["similar_cases"] else "No similar cases found in database."

        # M1: structured JSON output — LLM sets is_critical explicitly, no keyword scan
        system_prompt = (
            "You are an AI clinical decision support assistant. Analyze the patient presentation "
            "against similar historical cases and provide concise clinical guidance.\n\n"
            "Return a JSON object (no markdown, no code block):\n"
            '{"analysis": "**Differential Diagnosis:** ...\\n**Clinical Pearls:** ...\\n**Recommended Workup:** ...", '
            '"is_critical": true or false}\n\n'
            "Set is_critical=true ONLY if the presentation involves an immediately life-threatening condition "
            "(sepsis, MI, stroke, respiratory failure, anaphylaxis, hemorrhagic shock). "
            "is_critical=false for chronic conditions, follow-up care, or routine presentations. "
            "Keep analysis under 200 words. Be specific and clinically relevant."
        )

        user_msg = (
            f"Patient: {state['patient_name']}\n"
            f"Specialty: {state['specialty']}\n"
            f"Chief Complaint: {state['chief_complaint']}\n\n"
            f"Similar Cases:\n{case_text}"
        )

        raw = chat(system_prompt=system_prompt, user_message=user_msg, max_tokens=400)
        try:
            clean = raw.strip().strip("```json").strip("```").strip()
            parsed = json.loads(clean)
            analysis = parsed.get("analysis", raw)
            is_critical = bool(parsed.get("is_critical", False))
        except (json.JSONDecodeError, ValueError):
            analysis = raw
            is_critical = False

        log.info("[Agent2] Analysis done, is_critical=%s", is_critical)
        return {**state, "analysis": analysis, "is_critical": is_critical}

    except Exception as e:
        log.error("[Agent2] analyze_findings failed: %s", e)
        return {**state, "analysis": "Clinical analysis unavailable.", "is_critical": False, "error": str(e)}


# ── Node 3: Flag critical (Groq LLM — only fires when is_critical=True) ───────

def flag_critical(state: ClinicalState) -> ClinicalState:
    """
    Extracts specific critical flags from the analysis.
    Only fires when analyze_findings detected critical keywords.
    """
    try:
        system_prompt = (
            "Extract the specific critical clinical concerns from this analysis as a JSON array. "
            "Each item should be a short phrase (under 8 words). Return only the JSON array, no markdown:\n"
            '["concern 1", "concern 2"]'
        )

        raw = chat(
            system_prompt=system_prompt,
            user_message=f"Analysis:\n{state['analysis']}",
            max_tokens=80,
        )
        clean = raw.strip().strip("```json").strip("```").strip()
        flags = json.loads(clean)
        if not isinstance(flags, list):
            flags = ["Critical findings — review analysis"]

        log.info("[Agent2] Extracted %d critical flags", len(flags))
        return {**state, "critical_flags": flags}

    except Exception as e:
        log.error("[Agent2] flag_critical failed: %s", e)
        return {**state, "critical_flags": ["Critical findings detected — review urgently"]}


# ── Routing ───────────────────────────────────────────────────────────────────

def route_by_criticality(state: ClinicalState) -> Literal["flag_critical", "__end__"]:
    if state.get("is_critical"):
        return "flag_critical"
    return "__end__"


# ── Build graph ───────────────────────────────────────────────────────────────

def _build_graph():
    graph = StateGraph(ClinicalState)

    graph.add_node("search_cases",     search_cases)
    graph.add_node("analyze_findings", analyze_findings)
    graph.add_node("flag_critical",    flag_critical)

    graph.add_edge(START, "search_cases")
    graph.add_edge("search_cases", "analyze_findings")

    graph.add_conditional_edges("analyze_findings", route_by_criticality, {
        "flag_critical": "flag_critical",
        "__end__":       END,
    })

    graph.add_edge("flag_critical", END)
    return graph.compile()


clinical_graph = _build_graph()


def run(appointment_id: int, patient_name: str, specialty: str, chief_complaint: str) -> dict:
    initial: ClinicalState = {
        "appointment_id":  appointment_id,
        "patient_name":    patient_name,
        "specialty":       specialty,
        "chief_complaint": chief_complaint,
        "similar_cases":   [],
        "analysis":        "",
        "is_critical":     False,
        "critical_flags":  [],
        "error":           None,
    }
    result = clinical_graph.invoke(initial)
    return {
        "similar_cases":  result["similar_cases"],
        "analysis":       result["analysis"],
        "is_critical":    result["is_critical"],
        "critical_flags": result["critical_flags"],
        "error":          result["error"],
    }
